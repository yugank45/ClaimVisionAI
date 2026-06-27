"""
Core claim processing pipeline.
Orchestrates image analysis, decision generation, and output production.
"""
import logging
import time
import uuid
from pathlib import Path
from typing import Optional

from backend.models.claim import Claim, ImageAnalysis
from backend.services.openai_service import (
    analyze_image_with_vision,
    generate_final_decision,
    reset_token_stats,
    get_token_stats,
)
from backend.services.csv_service import (
    load_claims_csv,
    load_user_history_csv,
    load_evidence_requirements_csv,
    resolve_image_paths,
    get_dataset_info,
)
from backend.utils.image_utils import (
    encode_image_base64,
    get_image_extension,
    check_blur,
    check_image_valid,
    check_dark_image,
)
from backend.utils.json_utils import normalize_risk_flags

logger = logging.getLogger(__name__)

# Global processing state
_processing_state = {
    "is_processing": False,
    "current_claim": None,
    "total_claims": None,
    "progress_percent": None,
    "current_user_id": None,
    "status_message": None,
    "started_at": None,
    "elapsed_seconds": None,
}

# In-memory store of processed claims
_processed_claims: list[Claim] = []
_current_dataset: str = "sample"


def get_processing_status() -> dict:
    """Get current processing status."""
    state = dict(_processing_state)
    if state.get("started_at") and state["is_processing"]:
        state["elapsed_seconds"] = time.time() - state["started_at"]
    return state


def get_all_claims(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    object_type: Optional[str] = None,
) -> list[Claim]:
    """Get all processed claims with optional filters."""
    claims = list(_processed_claims)
    if status:
        claims = [c for c in claims if c.claim_status == status]
    if severity:
        claims = [c for c in claims if c.severity == severity]
    if object_type:
        claims = [c for c in claims if c.claim_object == object_type]
    return claims


def get_claim_by_id(claim_id: str) -> Optional[Claim]:
    """Get a single claim by its ID."""
    for claim in _processed_claims:
        if claim.id == claim_id:
            return claim
    return None


def get_analytics() -> dict:
    """Compute analytics from processed claims."""
    claims = _processed_claims
    total = len(claims)
    processed = [c for c in claims if c.processed]

    status_dist = {"supported": 0, "contradicted": 0, "not_enough_information": 0}
    severity_dist = {"none": 0, "low": 0, "medium": 0, "high": 0, "unknown": 0}
    risk_flag_freq: dict[str, int] = {}
    object_type_dist: dict[str, int] = {}

    evidence_met = 0
    total_tokens = 0
    processing_times = []

    for c in processed:
        # Status
        s = c.claim_status or "not_enough_information"
        if s in status_dist:
            status_dist[s] += 1

        # Severity
        sev = c.severity or "unknown"
        if sev in severity_dist:
            severity_dist[sev] += 1

        # Risk flags
        for flag in (c.risk_flags or []):
            if flag != "none":
                risk_flag_freq[flag] = risk_flag_freq.get(flag, 0) + 1

        # Object type
        obj = c.claim_object or "unknown"
        object_type_dist[obj] = object_type_dist.get(obj, 0) + 1

        # Evidence
        if c.evidence_standard_met:
            evidence_met += 1

        # Tokens
        total_tokens += c.token_usage or 0

        # Processing time
        if c.processing_time_seconds:
            processing_times.append(c.processing_time_seconds)

    n = len(processed) or 1
    evidence_rate = evidence_met / n if processed else 0.0
    avg_time = sum(processing_times) / len(processing_times) if processing_times else None

    # Cost estimate: gpt-4o-mini is ~$0.15/1M input tokens, $0.60/1M output tokens
    # Using a blended estimate of ~$0.25/1M tokens
    estimated_cost = (total_tokens / 1_000_000) * 0.25

    return {
        "total_claims": total,
        "status_distribution": status_dist,
        "severity_distribution": severity_dist,
        "risk_flag_frequency": risk_flag_freq,
        "object_type_distribution": object_type_dist,
        "evidence_standard_rate": evidence_rate,
        "avg_processing_time": avg_time,
        "total_tokens": total_tokens,
        "estimated_cost_usd": round(estimated_cost, 4),
    }


def process_claims(dataset: str = "sample", max_claims: Optional[int] = None) -> dict:
    """
    Main processing pipeline. Processes all claims in the dataset.
    Updates global state as it goes.
    """
    global _processed_claims, _current_dataset

    if _processing_state["is_processing"]:
        return {"success": False, "message": "Processing already in progress"}

    # Reset state
    _processed_claims = []
    _current_dataset = dataset
    reset_token_stats()

    start_time = time.time()
    _set_status(
        is_processing=True,
        status_message="Loading dataset...",
        started_at=start_time,
    )

    try:
        # Load data
        raw_claims = load_claims_csv(dataset)
        user_history = load_user_history_csv()
        evidence_requirements = load_evidence_requirements_csv()

        if not raw_claims:
            _set_status(is_processing=False, status_message="No claims found in dataset")
            return {
                "success": False,
                "message": "No claims found in dataset",
                "total_claims": 0,
                "processed_claims": 0,
                "runtime_seconds": 0,
                "total_tokens": 0,
                "output_file": None,
            }

        if max_claims:
            raw_claims = raw_claims[:max_claims]

        total = len(raw_claims)
        _set_status(total_claims=total, status_message=f"Processing {total} claims...")

        results: list[Claim] = []

        for idx, raw in enumerate(raw_claims):
            claim_id = f"{raw['user_id']}_{idx}"
            user_id = raw["user_id"]

            _set_status(
                current_claim=idx + 1,
                current_user_id=user_id,
                progress_percent=round((idx / total) * 100, 1),
                status_message=f"Analyzing claim {idx+1}/{total} for user {user_id}",
            )

            claim = Claim(
                id=claim_id,
                user_id=user_id,
                image_paths=raw["image_paths"],
                user_claim=raw["user_claim"],
                claim_object=raw["claim_object"],
            )

            claim_start = time.time()
            claim_tokens_before = get_token_stats()["total_tokens"]

            # Resolve and validate images
            resolved_paths = resolve_image_paths(raw["image_paths"], dataset)
            image_analyses: list[ImageAnalysis] = []

            for img_idx, img_path in enumerate(resolved_paths):
                image_id = f"img_{img_idx + 1}"

                # Image validation
                is_valid, validity_reason = check_image_valid(img_path)
                blur_score, is_blurry = check_blur(img_path) if is_valid else (0.0, True)
                is_dark = check_dark_image(img_path) if is_valid else False

                if not is_valid:
                    logger.warning(f"Invalid image {img_path}: {validity_reason}")
                    image_analyses.append(ImageAnalysis(
                        image_id=image_id,
                        image_path=img_path,
                        visible_issue="unknown",
                        object_part="unknown",
                        severity="unknown",
                        visible_damage=False,
                        image_quality="corrupted",
                        wrong_object=False,
                        explanation=f"Image could not be loaded: {validity_reason}",
                        blur_score=None,
                        is_blurry=True,
                    ))
                    continue

                # Encode and analyze with Vision API
                logger.info(f"[{image_id}] Loading image: {img_path}")
                img_b64 = encode_image_base64(img_path)
                if not img_b64:
                    logger.warning(f"[{image_id}] Failed to encode image: {img_path}")
                    image_analyses.append(ImageAnalysis(
                        image_id=image_id,
                        image_path=img_path,
                        visible_issue="unknown",
                        object_part="unknown",
                        severity="unknown",
                        visible_damage=False,
                        image_quality="corrupted",
                        wrong_object=False,
                        explanation="Could not read image file",
                        blur_score=None,
                        is_blurry=True,
                    ))
                    continue

                logger.info(f"[{image_id}] Encoded to base64 ({len(img_b64)} chars). Sending Vision request...")
                img_ext = get_image_extension(img_path)
                analysis_result = analyze_image_with_vision(
                    img_b64, img_ext, raw["user_claim"], raw["claim_object"], image_id
                )
                if analysis_result:
                    logger.info(f"[{image_id}] Vision response parsed: issue={analysis_result.get('visible_issue')} part={analysis_result.get('object_part')} severity={analysis_result.get('severity')}")
                else:
                    logger.warning(f"[{image_id}] Vision response parsing failed")

                if analysis_result:
                    # Override image quality if we detected quality issues locally
                    if is_blurry:
                        analysis_result["image_quality"] = "blurry"
                    elif is_dark:
                        analysis_result["image_quality"] = "dark"

                    image_analyses.append(ImageAnalysis(
                        image_id=image_id,
                        image_path=img_path,
                        blur_score=blur_score,
                        is_blurry=is_blurry,
                        **analysis_result,
                    ))

            # Get user history and evidence requirements
            history = user_history.get(user_id, {})
            obj_requirements = evidence_requirements.get(raw["claim_object"], {})

            # Check if user has high risk history
            has_history_risk = (
                history.get("fraud_flags", 0) > 0
                or str(history.get("risk_score", "")).lower() == "high"
            )

            # Generate final decision
            analyses_dicts = [
                {
                    "image_id": a.image_id,
                    "visible_issue": a.visible_issue,
                    "object_part": a.object_part,
                    "severity": a.severity,
                    "visible_damage": a.visible_damage,
                    "image_quality": a.image_quality,
                    "wrong_object": a.wrong_object,
                    "explanation": a.explanation,
                    "is_blurry": a.is_blurry,
                }
                for a in image_analyses
            ]

            decision = generate_final_decision(
                raw["user_claim"],
                raw["claim_object"],
                analyses_dicts,
                obj_requirements,
                history,
            )

            if decision:
                # Add user history risk flag if applicable
                if has_history_risk and "user_history_risk" not in decision["risk_flags"]:
                    decision["risk_flags"].append("user_history_risk")
                    if "none" in decision["risk_flags"]:
                        decision["risk_flags"].remove("none")

                claim.claim_status = decision["claim_status"]
                claim.evidence_standard_met = decision["evidence_standard_met"]
                claim.evidence_standard_met_reason = decision["evidence_standard_met_reason"]
                claim.risk_flags = decision["risk_flags"]
                claim.issue_type = decision["issue_type"]
                claim.object_part = decision["object_part"]
                claim.severity = decision["severity"]
                claim.supporting_image_ids = decision["supporting_image_ids"]
                claim.claim_status_justification = decision["justification"]

            # Set valid_image: true if at least one image loaded, not blurry, not wrong object
            if not image_analyses:
                claim.valid_image = False
            else:
                claim.valid_image = any(
                    not a.is_blurry
                    and not a.wrong_object
                    and a.image_quality not in ("corrupted", "unknown")
                    for a in image_analyses
                    if a.image_quality != "corrupted"
                )

            claim.image_analyses = image_analyses
            claim.processed = True
            claim.processing_time_seconds = time.time() - claim_start

            # Track tokens for this claim
            tokens_used = get_token_stats()["total_tokens"] - claim_tokens_before
            claim.token_usage = tokens_used

            results.append(claim)

        _processed_claims = results

        # Generate output CSV
        output_file = _save_output_csv(results)

        runtime = time.time() - start_time
        token_stats = get_token_stats()

        _set_status(
            is_processing=False,
            current_claim=total,
            progress_percent=100.0,
            status_message=f"Completed {total} claims in {runtime:.1f}s",
        )

        return {
            "success": True,
            "message": f"Successfully processed {len(results)} claims",
            "total_claims": total,
            "processed_claims": len(results),
            "output_file": output_file,
            "runtime_seconds": round(runtime, 2),
            "total_tokens": token_stats["total_tokens"],
        }

    except Exception as e:
        logger.error(f"Processing pipeline failed: {e}", exc_info=True)
        _set_status(is_processing=False, status_message=f"Error: {str(e)}")
        return {
            "success": False,
            "message": f"Processing failed: {str(e)}",
            "total_claims": 0,
            "processed_claims": 0,
            "runtime_seconds": 0,
            "total_tokens": 0,
            "output_file": None,
        }


def _save_output_csv(claims: list[Claim]) -> str:
    """Save processed claims to output/output.csv in the exact required format."""
    import csv

    Path("output").mkdir(exist_ok=True)
    output_path = "output/output.csv"

    fieldnames = [
        "user_id", "image_paths", "user_claim", "claim_object",
        "evidence_standard_met", "evidence_standard_met_reason",
        "risk_flags", "issue_type", "object_part", "claim_status",
        "claim_status_justification", "supporting_image_ids",
        "valid_image", "severity",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        for c in claims:
            # Restore original image path format (semicolon-separated, strip dataset/ prefix added during resolve)
            raw_paths = []
            for p in c.image_paths:
                # Strip the dataset/ prefix if it was added during resolution
                p_str = str(p)
                if p_str.startswith("dataset/"):
                    p_str = p_str[len("dataset/"):]
                raw_paths.append(p_str)

            writer.writerow({
                "user_id": c.user_id,
                "image_paths": ";".join(raw_paths),
                "user_claim": c.user_claim,
                "claim_object": c.claim_object,
                "evidence_standard_met": str(c.evidence_standard_met).lower() if c.evidence_standard_met is not None else "false",
                "evidence_standard_met_reason": c.evidence_standard_met_reason or "",
                "risk_flags": ";".join(c.risk_flags) if c.risk_flags else "none",
                "issue_type": c.issue_type or "unknown",
                "object_part": c.object_part or "unknown",
                "claim_status": c.claim_status or "not_enough_information",
                "claim_status_justification": c.claim_status_justification or "",
                "supporting_image_ids": ";".join(c.supporting_image_ids) if c.supporting_image_ids else "",
                "valid_image": str(c.valid_image).lower() if c.valid_image is not None else "false",
                "severity": c.severity or "unknown",
            })

    logger.info(f"Output saved to {output_path}")
    return output_path


def _set_status(**kwargs):
    """Update global processing state."""
    global _processing_state
    for k, v in kwargs.items():
        if k in _processing_state or k == "started_at":
            _processing_state[k] = v


def clear_claims():
    """Clear all processed claims (for re-processing)."""
    global _processed_claims
    _processed_claims = []
