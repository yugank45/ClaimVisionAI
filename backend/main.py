"""
ClaimVision AI - FastAPI Backend
Main application entry point.
"""
import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.routes.claims import router as claims_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ClaimVision AI",
    description="AI-powered multimodal insurance evidence verification system",
    version="1.0.0",
)

# CORS - allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/healthz")
async def health_check():
    return {"status": "ok"}

# Mount claim routes under /api prefix
app.include_router(claims_router, prefix="/api")

# Serve frontend static files in production (when dist/ exists)
_DIST_DIR = Path("dist")
if _DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        index = _DIST_DIR / "index.html"
        return FileResponse(str(index))

# Ensure required directories exist on startup
@app.on_event("startup")
async def startup():
    for d in ["dataset/images/sample", "dataset/images/test", "output", "backend/logs"]:
        Path(d).mkdir(parents=True, exist_ok=True)
    logger.info("ClaimVision AI backend started")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
