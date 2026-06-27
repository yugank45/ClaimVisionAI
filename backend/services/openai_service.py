"""
OpenAI / Groq Vision API integration.
Rate-limited: proactive inter-call pacing + Retry-After-aware 429 recovery.
"""
import logging
import re
import threading
import time
from typing import Optional

from openai import OpenAI, RateLimitError, APIError

from backend.prompts.vision_prompt import (
    VISION_SYSTEM_PROMPT,
    DECISION_SYSTEM_PROMPT,
    build_vision_prompt,
    build_decision_prompt,
)
from backend.utils.json_utils import (
    extract_json_from_response,
    normalize_claim_status,
    normalize_issue_type,
    normalize_severity,
    normalize_risk_flags,
    normalize_object_part,
    safe_bool,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Token / call tracking
# ---------------------------------------------------------------------------
_total_tokens = 0
_total_api_calls = 0


def get_token_stats() -> dict:
    return {"total_tokens": _total_tokens, "total_api_calls": _total_api_calls}


def reset_token_stats():
    global _total_tokens, _total_api_calls
    _total_tokens = 0
    _total_api_calls = 0


# ---------------------------------------------------------------------------
# Provider detection
# ---------------------------------------------------------------------------
def _detect_provider() -> str:
    import os
    key = os.environ.get("OPENAI_API_KEY", "")
    if key.startswith("sk-or-"):
        return "openrouter"
    if key.startswith("gsk_"):
        return "groq"
    return "openai"


def get_openai_client() -> OpenAI:
    import os
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    provider = _detect_provider()
    if provider == "openrouter":
        return OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
    if provider == "groq":
        return OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    return OpenAI(api_key=api_key)


def _model_name(vision: bool = False) -> str:
    provider = _detect_provider()
    if provider == "openrouter":
        return "openai/gpt-4o-mini"
    if provider == "groq":
        return "meta-llama/llama-4-scout-17b-16e-instruct" if vision else "llama-3.3-70b-versatile"
    return "gpt-4o-mini"


# ---------------------------------------------------------------------------
# Proactive rate limiter
# Groq free tier: 30 RPM.  We pace at 25 RPM (2.4 s between calls) to leave
# headroom for retries.  OpenAI / OpenRouter have higher limits so we use 50 RPM.
# ---------------------------------------------------------------------------
_RPM = {"groq": 25, "openrouter": 50, "openai": 50}


class _RateLimiter:
    """Thread-safe minimum-interval gate between consecutive API calls."""

    def __init__(self):
        self._lock = threading.Lock()
        self._last_call: float = 0.0
        self._blocked_until: float = 0.0   # hard pause after a 429

    def _interval(self) -> float:
        rpm = _RPM.get(_detect_provider(), 25)
        return 60.0 / rpm

    def wait(self, label: str = "") -> None:
        """Block until it's safe to fire the next request."""
        with self._lock:
            now = time.monotonic()

            # Respect any hard pause imposed by a 429
            if now < self._blocked_until:
                pause = self._blocked_until - now
                logger.info(f"[rate-limiter] hard pause {pause:.1f}s{' (' + label + ')' if label else ''}")
                time.sleep(pause)
                now = time.monotonic()

            # Proactive pacing
            elapsed = now - self._last_call
            interval = self._interval()
            if elapsed < interval:
                wait = interval - elapsed
                logger.debug(f"[rate-limiter] pacing {wait:.2f}s")
                time.sleep(wait)

            self._last_call = time.monotonic()

    def on_rate_limit(self, error: RateLimitError) -> float:
        """
        Parse Retry-After from a 429 response and impose a hard pause.
        Returns the number of seconds we will wait.
        """
        wait = 60.0  # safe default
        try:
            # openai SDK exposes the raw response
            headers = getattr(error, "response", None)
            if headers is not None:
                headers = getattr(headers, "headers", {})
                retry_after = headers.get("retry-after") or headers.get("x-ratelimit-reset-requests")
                if retry_after:
                    # Value is either seconds (int) or an ISO-8601 duration like "1m2s"
                    wait = _parse_retry_after(str(retry_after))
        except Exception:
            pass

        # Add a small buffer so we don't immediately re-hit the limit
        wait = max(wait + 2, 5)
        with self._lock:
            self._blocked_until = time.monotonic() + wait
        logger.warning(f"[rate-limiter] 429 received — waiting {wait:.0f}s before next call")
        return wait


def _parse_retry_after(value: str) -> float:
    """Parse seconds from a Retry-After value: plain int, float, or ISO-8601 duration."""
    value = value.strip()
    try:
        return float(value)
    except ValueError:
        pass
    # e.g. "1m2s", "30s", "2m"
    total = 0.0
    for num, unit in re.findall(r"(\d+(?:\.\d+)?)\s*([smh])", value.lower()):
        n = float(num)
        if unit == "h":
            total += n * 3600
        elif unit == "m":
            total += n * 60
        else:
            total += n
    return total if total else 60.0


_rate_limiter = _RateLimiter()


# ---------------------------------------------------------------------------
# Vision analysis
# ---------------------------------------------------------------------------
def analyze_image_with_vision(
    image_base64: str,
    image_ext: str,
    claim_text: str,
    claim_object: str,
    image_id: str,
    max_retries: int = 8,
) -> Optional[dict]:
    """
    Analyse a single image via Vision API.
    Rate-limited proactively; respects Retry-After on 429.
    """
    global _total_tokens, _total_api_calls

    client = get_openai_client()
    prompt = build_vision_prompt(claim_text, claim_object)

    for attempt in range(max_retries):
        _rate_limiter.wait(label=image_id)
        try:
            logger.info(f"Vision request: {image_id} (attempt {attempt + 1}/{max_retries})")

            response = client.chat.completions.create(
                model=_model_name(vision=True),
                max_tokens=800,
                messages=[
                    {"role": "system", "content": VISION_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/{image_ext};base64,{image_base64}",
                                    **({"detail": "high"} if _detect_provider() == "openai" else {}),
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    },
                ],
            )

            if response.usage:
                _total_tokens += response.usage.total_tokens
            _total_api_calls += 1

            content = response.choices[0].message.content or ""
            parsed = extract_json_from_response(content)

            if not parsed:
                logger.warning(f"Failed to parse vision response for {image_id}")
                if attempt < max_retries - 1:
                    time.sleep(min(2 ** attempt, 30))
                    continue
                return _default_image_analysis(image_id)

            return {
                "visible_issue": normalize_issue_type(parsed.get("visible_issue")),
                "object_part": normalize_object_part(parsed.get("object_part"), claim_object),
                "severity": normalize_severity(parsed.get("severity")),
                "visible_damage": safe_bool(parsed.get("visible_damage"), False),
                "image_quality": str(parsed.get("image_quality", "unknown"))[:50],
                "wrong_object": safe_bool(parsed.get("wrong_object"), False),
                "explanation": str(parsed.get("explanation", ""))[:500],
            }

        except RateLimitError as e:
            wait = _rate_limiter.on_rate_limit(e)
            if attempt == max_retries - 1:
                logger.error(f"Rate limit exhausted after {max_retries} retries for {image_id}")
                return _default_image_analysis(image_id)
            time.sleep(wait)

        except APIError as e:
            logger.error(f"API error for {image_id}: {e}")
            if attempt < max_retries - 1:
                time.sleep(min(2 ** attempt, 30))
            else:
                return _default_image_analysis(image_id)

        except Exception as e:
            logger.error(f"Unexpected error for {image_id}: {e}")
            return _default_image_analysis(image_id)

    return _default_image_analysis(image_id)


# ---------------------------------------------------------------------------
# Final decision
# ---------------------------------------------------------------------------
def generate_final_decision(
    claim_text: str,
    claim_object: str,
    image_analyses: list[dict],
    evidence_requirements: dict,
    user_history: dict,
    max_retries: int = 8,
) -> Optional[dict]:
    """
    Generate final claim decision.
    Rate-limited proactively; respects Retry-After on 429.
    """
    global _total_tokens, _total_api_calls

    client = get_openai_client()
    prompt = build_decision_prompt(
        claim_text, claim_object, image_analyses, evidence_requirements, user_history
    )

    for attempt in range(max_retries):
        _rate_limiter.wait(label="decision")
        try:
            response = client.chat.completions.create(
                model=_model_name(),
                max_tokens=1000,
                messages=[
                    {"role": "system", "content": DECISION_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            )

            if response.usage:
                _total_tokens += response.usage.total_tokens
            _total_api_calls += 1

            content = response.choices[0].message.content or ""
            parsed = extract_json_from_response(content)

            if not parsed:
                logger.warning("Failed to parse decision response")
                if attempt < max_retries - 1:
                    time.sleep(min(2 ** attempt, 30))
                    continue
                return _default_decision()

            return {
                "claim_status": normalize_claim_status(parsed.get("claim_status")),
                "evidence_standard_met": safe_bool(parsed.get("evidence_standard_met"), False),
                "evidence_standard_met_reason": str(parsed.get("evidence_standard_met_reason", ""))[:300],
                "risk_flags": normalize_risk_flags(parsed.get("risk_flags", [])),
                "issue_type": normalize_issue_type(parsed.get("issue_type")),
                "object_part": normalize_object_part(parsed.get("object_part"), claim_object),
                "severity": normalize_severity(parsed.get("severity")),
                "supporting_image_ids": [
                    str(x) for x in (parsed.get("supporting_image_ids") or [])
                ],
                "justification": str(parsed.get("justification", ""))[:1000],
            }

        except RateLimitError as e:
            wait = _rate_limiter.on_rate_limit(e)
            if attempt == max_retries - 1:
                logger.error(f"Rate limit exhausted after {max_retries} retries on decision")
                return _default_decision()
            time.sleep(wait)

        except APIError as e:
            logger.error(f"API error on decision: {e}")
            if attempt < max_retries - 1:
                time.sleep(min(2 ** attempt, 30))
            else:
                return _default_decision()

        except Exception as e:
            logger.error(f"Unexpected error on decision: {e}")
            return _default_decision()

    return _default_decision()


# ---------------------------------------------------------------------------
# Fallbacks
# ---------------------------------------------------------------------------
def _default_image_analysis(image_id: str) -> dict:
    return {
        "visible_issue": "unknown",
        "object_part": "unknown",
        "severity": "unknown",
        "visible_damage": False,
        "image_quality": "unknown",
        "wrong_object": False,
        "explanation": "Analysis failed — API unavailable after retries",
    }


def _default_decision() -> dict:
    return {
        "claim_status": "not_enough_information",
        "evidence_standard_met": False,
        "evidence_standard_met_reason": "Analysis failed — API unavailable after retries",
        "risk_flags": ["manual_review_required"],
        "issue_type": "unknown",
        "object_part": "unknown",
        "severity": "unknown",
        "supporting_image_ids": [],
        "justification": "Automated analysis failed after rate-limit retries. Manual review required.",
    }
