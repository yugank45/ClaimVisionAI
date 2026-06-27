"""
JSON normalization utilities.
Handles cleaning AI responses and normalizing values to allowed enums.
"""
import json
import re
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def extract_json_from_response(text: str) -> Optional[dict]:
    """
    Extract JSON from an AI response that may contain markdown code blocks
    or extra text. Returns parsed dict or None.
    """
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    code_block_pattern = r"```(?:json)?\s*([\s\S]*?)```"
    matches = re.findall(code_block_pattern, text)
    for match in matches:
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue

    json_pattern = r"\{[\s\S]*\}"
    matches = re.findall(json_pattern, text)
    for match in matches:
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            continue

    logger.warning(f"Could not extract JSON from response: {text[:200]}")
    return None


def normalize_claim_status(value: Any) -> str:
    from backend.models.claim import ALLOWED_CLAIM_STATUSES
    if not value or not isinstance(value, str):
        return "not_enough_information"
    value = value.lower().strip().replace(" ", "_").replace("-", "_")
    if value in ALLOWED_CLAIM_STATUSES:
        return value
    if "support" in value:
        return "supported"
    if "contradict" in value or "deny" in value or "denied" in value:
        return "contradicted"
    return "not_enough_information"


def normalize_issue_type(value: Any) -> str:
    from backend.models.claim import ALLOWED_ISSUE_TYPES
    if not value or not isinstance(value, str):
        return "unknown"
    value = value.lower().strip().replace(" ", "_").replace("-", "_")
    if value in ALLOWED_ISSUE_TYPES:
        return value
    mapping = {
        "dented": "dent", "scratched": "scratch", "cracked": "crack",
        "shattered": "glass_shatter", "broken": "broken_part",
        "missing": "missing_part", "torn": "torn_packaging",
        "crushed": "crushed_packaging", "water": "water_damage", "stained": "stain",
    }
    for k, v in mapping.items():
        if k in value:
            return v
    return "unknown"


def normalize_severity(value: Any) -> str:
    from backend.models.claim import ALLOWED_SEVERITIES
    if not value or not isinstance(value, str):
        return "unknown"
    value = value.lower().strip()
    if value in ALLOWED_SEVERITIES:
        return value
    return "unknown"


_OBJECT_PART_ENUMS = {
    "car": {"front_bumper", "rear_bumper", "door", "hood", "windshield",
            "side_mirror", "headlight", "taillight", "fender", "quarter_panel", "body", "unknown"},
    "laptop": {"screen", "keyboard", "trackpad", "hinge", "lid",
               "corner", "port", "base", "body", "unknown"},
    "package": {"box", "package_corner", "package_side", "seal",
                "label", "contents", "item", "unknown"},
}

_OBJECT_PART_FUZZY = {
    # car
    "bumper": "front_bumper", "front bumper": "front_bumper", "rear bumper": "rear_bumper",
    "back bumper": "rear_bumper", "front_bumper": "front_bumper", "rear_bumper": "rear_bumper",
    "side mirror": "side_mirror", "mirror": "side_mirror", "windshield": "windshield",
    "front glass": "windshield", "glass": "windshield", "headlight": "headlight",
    "taillight": "taillight", "tail light": "taillight", "back light": "taillight",
    "fender": "fender", "quarter panel": "quarter_panel", "hood": "hood",
    # laptop
    "display": "screen", "lcd": "screen", "trackpad": "trackpad", "touchpad": "trackpad",
    "hinge": "hinge", "keyboard": "keyboard", "keys": "keyboard",
    # package
    "corner": "package_corner", "side": "package_side", "seal": "seal",
    "label": "label", "contents": "contents", "item": "item",
}


def normalize_object_part(value: Any, claim_object: str = "") -> str:
    """Normalize object_part to allowed enum value for the given claim_object."""
    if not value or not isinstance(value, str):
        return "unknown"
    normalized = value.lower().strip().replace(" ", "_").replace("-", "_")
    allowed = _OBJECT_PART_ENUMS.get(claim_object.lower(), set())
    if normalized in allowed:
        return normalized
    # Try fuzzy map on original value
    fuzzy_key = value.lower().strip()
    if fuzzy_key in _OBJECT_PART_FUZZY:
        candidate = _OBJECT_PART_FUZZY[fuzzy_key]
        if not allowed or candidate in allowed:
            return candidate
    # Try the normalized form in fuzzy map
    if normalized.replace("_", " ") in _OBJECT_PART_FUZZY:
        candidate = _OBJECT_PART_FUZZY[normalized.replace("_", " ")]
        if not allowed or candidate in allowed:
            return candidate
    # If we have an allowed set and value isn't in it, return unknown
    return "unknown" if allowed else normalized


def normalize_risk_flags(flags: Any) -> list:
    from backend.models.claim import ALLOWED_RISK_FLAGS
    if not flags:
        return ["none"]
    if isinstance(flags, str):
        flags = [flags]
    result = []
    for flag in flags:
        flag = flag.lower().strip().replace(" ", "_").replace("-", "_")
        if flag in ALLOWED_RISK_FLAGS:
            result.append(flag)
    return result if result else ["none"]


def safe_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("true", "yes", "1")
    if isinstance(value, (int, float)):
        return bool(value)
    return default
