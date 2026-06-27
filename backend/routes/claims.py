"""
Claims API routes.
Handles upload, processing, retrieval, and download.
"""
import threading
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional

from backend.services.claim_processor import (
    process_claims,
    get_all_claims,
    get_claim_by_id,
    get_processing_status,
    get_analytics,
    clear_claims,
)
from backend.services.csv_service import get_dataset_info
from backend.models.claim import Claim, ImageAnalysis

logger = logging.getLogger(__name__)

router = APIRouter()

# Track background processing thread
_processing_thread: Optional[threading.Thread] = None


class ProcessRequest(BaseModel):
    dataset: str = "sample"
    max_claims: Optional[int] = None


def _claim_to_dict(c: Claim) -> dict:
    """Convert Claim dataclass to JSON-serializable dict."""
    analyses = None
    if c.image_analyses:
        analyses = [
            {
                "image_id": a.image_id,
                "image_path": a.image_path,
                "visible_issue": a.visible_issue,
                "object_part": a.object_part,
                "severity": a.severity,
                "visible_damage": a.visible_damage,
                "image_quality": a.image_quality,
                "wrong_object": a.wrong_object,
                "explanation": a.explanation,
                "blur_score": a.blur_score,
                "is_blurry": a.is_blurry,
            }
            for a in c.image_analyses
        ]

    return {
        "id": c.id,
        "user_id": c.user_id,
        "image_paths": c.image_paths,
        "user_claim": c.user_claim,
        "claim_object": c.claim_object,
        "evidence_standard_met": c.evidence_standard_met,
        "evidence_standard_met_reason": c.evidence_standard_met_reason,
        "risk_flags": c.risk_flags,
        "issue_type": c.issue_type,
        "object_part": c.object_part,
        "claim_status": c.claim_status,
        "claim_status_justification": c.claim_status_justification,
        "supporting_image_ids": c.supporting_image_ids,
        "valid_image": c.valid_image,
        "severity": c.severity,
        "processed": c.processed,
        "image_analyses": analyses,
        "processing_time_seconds": c.processing_time_seconds,
        "token_usage": c.token_usage,
    }


@router.get("/claims")
async def get_claims_route(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    object_type: Optional[str] = Query(None),
):
    claims = get_all_claims(status=status, severity=severity, object_type=object_type)
    return [_claim_to_dict(c) for c in claims]


@router.get("/claims/{claim_id}")
async def get_claim_route(claim_id: str):
    claim = get_claim_by_id(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return _claim_to_dict(claim)


@router.post("/upload-dataset")
async def upload_dataset_route(
    claims_csv: Optional[UploadFile] = File(None),
    user_history_csv: Optional[UploadFile] = File(None),
    evidence_requirements_csv: Optional[UploadFile] = File(None),
):
    """Upload CSV files to the dataset directory."""
    Path("dataset").mkdir(exist_ok=True)
    files_uploaded = []

    file_map = {
        "sample_claims.csv": claims_csv,
        "user_history.csv": user_history_csv,
        "evidence_requirements.csv": evidence_requirements_csv,
    }

    for filename, upload in file_map.items():
        if upload and upload.filename:
            dest = Path("dataset") / filename
            content = await upload.read()
            with open(dest, "wb") as f:
                f.write(content)
            files_uploaded.append(filename)
            logger.info(f"Saved uploaded file: {dest}")

    # Count claims in the uploaded file
    claims_count = 0
    claims_path = Path("dataset/sample_claims.csv")
    if claims_path.exists():
        try:
            import csv
            with open(claims_path) as f:
                claims_count = sum(1 for _ in csv.DictReader(f))
        except Exception:
            pass

    return {
        "success": True,
        "message": f"Uploaded {len(files_uploaded)} file(s)",
        "claims_count": claims_count,
        "files_uploaded": files_uploaded,
    }


@router.post("/process-claims")
async def process_claims_route(request: ProcessRequest, background_tasks: BackgroundTasks):
    """Start processing claims in the background."""
    global _processing_thread

    status = get_processing_status()
    if status["is_processing"]:
        return {
            "success": False,
            "message": "Processing already in progress",
            "total_claims": 0,
            "processed_claims": 0,
            "runtime_seconds": 0,
            "total_tokens": 0,
            "output_file": None,
        }

    clear_claims()

    # Run processing in background thread to avoid blocking the event loop
    result_holder = {}

    def run_processing():
        result = process_claims(
            dataset=request.dataset,
            max_claims=request.max_claims,
        )
        result_holder.update(result)

    _processing_thread = threading.Thread(target=run_processing, daemon=True)
    _processing_thread.start()

    return {
        "success": True,
        "message": f"Processing started for '{request.dataset}' dataset",
        "total_claims": 0,
        "processed_claims": 0,
        "runtime_seconds": 0,
        "total_tokens": 0,
        "output_file": None,
    }


@router.get("/processing-status")
async def processing_status_route():
    return get_processing_status()


@router.get("/download-output")
async def download_output_route():
    """Download the generated output.csv."""
    output_path = Path("output/output.csv")
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="No output file available. Run processing first.")

    return FileResponse(
        path=str(output_path),
        media_type="text/csv",
        filename="claimvision_output.csv",
    )


@router.get("/analytics")
async def analytics_route():
    return get_analytics()


@router.get("/dataset-info")
async def dataset_info_route():
    info = get_dataset_info()
    claims = get_all_claims()
    info["processed_claims_count"] = len(claims)
    return info


@router.get("/image-coverage")
async def image_coverage_route():
    """Return image coverage report for all claims in both CSVs."""
    import csv as csv_mod

    def parse_paths(csv_path: Path):
        rows = []
        if not csv_path.exists():
            return rows
        with open(csv_path, encoding="utf-8") as f:
            for row in csv_mod.DictReader(f):
                raw = row.get("image_paths", "") or ""
                if ";" in raw:
                    parts = [p.strip() for p in raw.split(";") if p.strip()]
                elif "|" in raw:
                    parts = [p.strip() for p in raw.split("|") if p.strip()]
                else:
                    parts = [raw.strip()] if raw.strip() else []
                for p in parts:
                    rows.append({
                        "source": csv_path.name,
                        "user_id": row.get("user_id", ""),
                        "image_path": p,
                    })
        return rows

    all_refs = (
        parse_paths(Path("dataset/sample_claims.csv")) +
        parse_paths(Path("dataset/claims.csv"))
    )

    existing, missing = [], []
    missing_dirs: set[str] = set()

    for ref in all_refs:
        img_path = ref["image_path"]
        candidates = [Path(img_path), Path("dataset") / img_path]
        found = next((str(c) for c in candidates if c.exists()), None)
        entry = {**ref, "resolved_path": found}
        if found:
            existing.append(entry)
        else:
            missing.append(entry)
            missing_dirs.add(str((Path("dataset") / Path(img_path).parent)))

    total = len(all_refs)
    return {
        "total_references": total,
        "existing_count": len(existing),
        "missing_count": len(missing),
        "coverage_percent": round(len(existing) / total * 100, 1) if total else 0,
        "missing_dirs": sorted(missing_dirs),
        "existing": existing,
        "missing": missing,
    }


@router.post("/upload-images-zip")
async def upload_images_zip_route(
    zip_file: UploadFile = File(...),
    target: str = Form("test"),
):
    """
    Accept a ZIP file and extract all images into dataset/images/{target}/.
    Handles any nesting level including:
      - flat: img_1.jpg
      - nested: case_001/img_1.jpg
      - wrapped in a top-level folder: my_dataset/case_001/img_1.jpg
      - known prefixes: images/test/case_001/img_1.jpg
    """
    import zipfile
    import io

    IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    content = await zip_file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Empty ZIP file")

    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file — make sure you upload a .zip archive, not a folder")

    base_dir = Path("dataset") / "images" / target
    base_dir.mkdir(parents=True, exist_ok=True)

    # Collect all file entries (skip directories and hidden/metadata files)
    all_names = [
        n for n in zf.namelist()
        if not n.endswith("/")
        and not any(part.startswith(".") or part.startswith("__MACOSX") for part in Path(n).parts)
    ]

    image_names = [n for n in all_names if Path(n).suffix.lower() in IMAGE_EXTS]
    skipped = [n for n in all_names if Path(n).suffix.lower() not in IMAGE_EXTS]

    if not image_names:
        return {
            "success": False,
            "extracted_count": 0,
            "skipped_count": len(skipped),
            "target_dir": str(base_dir),
            "message": "No images found in ZIP. Make sure it contains .jpg/.jpeg/.png/.webp files.",
            "files": [],
        }

    # Detect a single top-level wrapper folder that all entries share, and strip it.
    # This handles the common case where a user zips an entire folder: my_folder/case_001/img.jpg
    def detect_common_prefix(names: list[str]) -> tuple:
        """Return the common leading path parts shared by every entry, if any."""
        first_parts = Path(names[0]).parts
        for length in range(len(first_parts), 0, -1):
            prefix = first_parts[:length]
            if all(Path(n).parts[:length] == prefix for n in names):
                return prefix
        return ()

    common_prefix = detect_common_prefix(image_names)
    # Only strip prefix when ALL images are under a single top-level folder
    # (i.e. a non-empty common prefix whose first element is a folder, not a filename)
    top_level_folder_prefix: tuple = ()
    if common_prefix and len(common_prefix) >= 1:
        # Check that the shared prefix ends before the filename (is purely a directory prefix)
        candidate = common_prefix
        if all(len(Path(n).parts) > len(candidate) for n in image_names):
            top_level_folder_prefix = candidate

    # Known prefixes to strip (checked after common-prefix stripping)
    known_prefixes = [
        ("images", target), ("images", "test"), ("images", "sample"),
        (target,), ("test",), ("sample",),
    ]

    extracted = []

    for name in image_names:
        parts = Path(name).parts

        # 1. Strip auto-detected common top-level folder
        if top_level_folder_prefix and parts[:len(top_level_folder_prefix)] == top_level_folder_prefix:
            parts = parts[len(top_level_folder_prefix):]

        # 2. Strip known prefixes
        for prefix in known_prefixes:
            if parts[:len(prefix)] == prefix:
                parts = parts[len(prefix):]
                break

        dest = base_dir / Path(*parts) if parts else base_dir / Path(name).name
        dest.parent.mkdir(parents=True, exist_ok=True)

        with zf.open(name) as src, open(dest, "wb") as dst:
            dst.write(src.read())
        extracted.append(str(dest))
        logger.info(f"Extracted: {name} → {dest}")

    return {
        "success": True,
        "extracted_count": len(extracted),
        "skipped_count": len(skipped),
        "target_dir": str(base_dir),
        "message": f"Extracted {len(extracted)} images into dataset/images/{target}/",
        "files": extracted[:50],
    }
