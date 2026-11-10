"""API route for serving question and option image assets."""

from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.app.config import ASSETS_DIR

router = APIRouter(prefix="/assets", tags=["Assets"])

FALLBACK_ASSETS_DIR = Path("testbench/public/papers/assets")


@router.get("/{paper_id}/{filename}")
def get_image_asset(paper_id: str, filename: str):
    """Serve a question or option PNG image."""
    # Prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    primary_path = ASSETS_DIR / paper_id / filename
    if primary_path.exists():
        return FileResponse(
            str(primary_path),
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    fallback_path = FALLBACK_ASSETS_DIR / paper_id / filename
    if fallback_path.exists():
        return FileResponse(
            str(fallback_path),
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    raise HTTPException(status_code=404, detail=f"Asset '{filename}' not found for paper '{paper_id}'")
