"""
CSV loading and parsing service.
Handles reading claims, user history, and evidence requirements.
"""
import csv
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATASET_BASE = Path("dataset")


def load_claims_csv(dataset: str = "sample") -> list[dict]:
    """
    Load claims from CSV. Returns list of raw claim dicts.
    dataset: 'sample' or 'test'
    """
    if dataset == "sample":
        path = DATASET_BASE / "sample_claims.csv"
        if not path.exists():
            path = DATASET_BASE / "claims.csv"
    else:
        path = DATASET_BASE / "claims.csv"

    if not path.exists():
        logger.error(f"Claims CSV not found: {path}")
        return []

    claims = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Normalize image_paths: could be semicolon, pipe, or comma-separated
                raw_paths = row.get("image_paths", "") or ""
                if ";" in raw_paths:
                    image_paths = [p.strip() for p in raw_paths.split(";") if p.strip()]
                elif "|" in raw_paths:
                    image_paths = [p.strip() for p in raw_paths.split("|") if p.strip()]
                elif "," in raw_paths:
                    image_paths = [p.strip() for p in raw_paths.split(",") if p.strip()]
                else:
                    image_paths = [raw_paths.strip()] if raw_paths.strip() else []

                claims.append({
                    "user_id": str(row.get("user_id", "")).strip(),
                    "image_paths": image_paths,
                    "user_claim": str(row.get("user_claim", "")).strip(),
                    "claim_object": str(row.get("claim_object", "")).strip().lower(),
                })
        logger.info(f"Loaded {len(claims)} claims from {path}")
        return claims
    except Exception as e:
        logger.error(f"Failed to load claims CSV: {e}")
        return []


def load_user_history_csv() -> dict[str, dict]:
    """
    Load user history CSV. Returns dict keyed by user_id.
    """
    path = DATASET_BASE / "user_history.csv"
    if not path.exists():
        logger.warning("user_history.csv not found, proceeding without history")
        return {}

    history = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                user_id = str(row.get("user_id", "")).strip()
                history[user_id] = {
                    "prior_claims": _safe_int(row.get("prior_claims")),
                    "fraud_flags": _safe_int(row.get("fraud_flags")),
                    "approved_claims": _safe_int(row.get("approved_claims")),
                    "risk_score": str(row.get("risk_score", "unknown")).strip(),
                }
        logger.info(f"Loaded history for {len(history)} users")
        return history
    except Exception as e:
        logger.error(f"Failed to load user history: {e}")
        return {}


def load_evidence_requirements_csv() -> dict[str, dict]:
    """
    Load evidence requirements CSV. Returns dict keyed by claim_object.
    """
    path = DATASET_BASE / "evidence_requirements.csv"
    if not path.exists():
        logger.warning("evidence_requirements.csv not found, using defaults")
        return _default_evidence_requirements()

    requirements = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                obj_type = str(row.get("claim_object", "")).strip().lower()
                requirements[obj_type] = {
                    "min_images": _safe_int(row.get("min_images"), 1),
                    "requires_part_visible": _safe_bool(row.get("requires_part_visible")),
                    "notes": str(row.get("notes", "")).strip(),
                }
        logger.info(f"Loaded evidence requirements for: {list(requirements.keys())}")
        return requirements
    except Exception as e:
        logger.error(f"Failed to load evidence requirements: {e}")
        return _default_evidence_requirements()


def _default_evidence_requirements() -> dict[str, dict]:
    """Default evidence requirements when CSV is not available."""
    return {
        "car": {"min_images": 2, "requires_part_visible": True, "notes": "Show damaged area clearly"},
        "laptop": {"min_images": 1, "requires_part_visible": True, "notes": "Show damaged component"},
        "package": {"min_images": 1, "requires_part_visible": False, "notes": "Show packaging damage"},
    }


def resolve_image_paths(image_paths: list[str], dataset: str = "sample") -> list[str]:
    """
    Resolve image paths relative to the dataset/images directory.
    Tries multiple path strategies.
    Image paths from CSV may be like:
      - images/test/case_001/img_1.jpg  (relative, prefixed with images/)
      - images/sample/case_001/img_1.jpg
      - some/absolute/path.jpg
    """
    resolved = []

    for raw_path in image_paths:
        path = Path(raw_path)

        # Already absolute and exists
        if path.is_absolute() and path.exists():
            resolved.append(str(path))
            continue

        # Try as-is (relative to cwd = /home/runner/workspace)
        if path.exists():
            resolved.append(str(path))
            continue

        # Try with dataset/ prefix (handles "images/test/..." paths from CSV)
        candidate = DATASET_BASE / raw_path
        if candidate.exists():
            resolved.append(str(candidate))
            continue

        # Try relative to dataset/images/{dataset}/
        image_dir = DATASET_BASE / "images" / dataset
        candidate = image_dir / path.name
        if candidate.exists():
            resolved.append(str(candidate))
            continue

        # Log missing but include anyway (will be handled gracefully later)
        logger.warning(f"Could not resolve image path: {raw_path}")
        resolved.append(raw_path)

    return resolved


def get_dataset_info() -> dict:
    """Return info about what dataset files are available."""
    sample_claims_path = DATASET_BASE / "sample_claims.csv"
    test_claims_path = DATASET_BASE / "claims.csv"
    user_history_path = DATASET_BASE / "user_history.csv"
    evidence_req_path = DATASET_BASE / "evidence_requirements.csv"
    sample_images = DATASET_BASE / "images" / "sample"
    test_images = DATASET_BASE / "images" / "test"

    sample_count = None
    if sample_claims_path.exists():
        try:
            with open(sample_claims_path) as f:
                sample_count = sum(1 for _ in csv.DictReader(f))
        except Exception:
            pass

    test_count = None
    if test_claims_path.exists():
        try:
            with open(test_claims_path) as f:
                test_count = sum(1 for _ in csv.DictReader(f))
        except Exception:
            pass

    return {
        "has_sample_claims": sample_claims_path.exists(),
        "has_test_claims": test_claims_path.exists(),
        "has_user_history": user_history_path.exists(),
        "has_evidence_requirements": evidence_req_path.exists(),
        "sample_claims_count": sample_count,
        "test_claims_count": test_count,
        "has_sample_images": sample_images.exists() and any(sample_images.iterdir()) if sample_images.exists() else False,
        "has_test_images": test_images.exists() and any(test_images.iterdir()) if test_images.exists() else False,
    }


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_bool(value, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("true", "yes", "1")
    return default
