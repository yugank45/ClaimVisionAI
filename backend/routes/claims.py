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
    The ZIP can contain images at any nesting level:
      - flat: img_1.jpg → placed in dataset/images/{target}/
      - nested: case_001/img_1.jpg → placed in dataset/images/{target}/case_001/img_1.jpg
      - double-nested: images/test/case_001/img_1.jpg → strips the prefix
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
        raise HTTPException(status_code=400, detail="Invalid ZIP file")

    base_dir = Path("dataset") / "images" / target
    extracted = []
    skipped = []

    for name in zf.namelist():
        # Skip directories and hidden files
        if name.endswith("/") or "/." in name or name.startswith("."):
            continue
        p = Path(name)
        if p.suffix.lower() not in IMAGE_EXTS:
            skipped.append(name)
            continue

        # Strip common prefixes: images/test/, images/sample/, test/, sample/
        parts = p.parts
        strip_prefixes = [("images", target), ("images", "test"), ("images", "sample"), (target,), ("test",), ("sample",)]
        rel_parts = parts
        for prefix in strip_prefixes:
            if parts[:len(prefix)] == prefix:
                rel_parts = parts[len(prefix):]
                break

        dest = base_dir / Path(*rel_parts) if rel_parts else base_dir / p.name
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
        "files": extracted[:50],  # return first 50 for display
    }
