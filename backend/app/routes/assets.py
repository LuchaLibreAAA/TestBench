"""Serve validated paper PNG assets with content-based cache validators."""

import hashlib
from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import FileResponse, Response

from backend.app.services.assets import resolve_asset

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("/{paper_id}/{filename}")
def get_image_asset(paper_id: str, filename: str, request: Request,
                    if_none_match: str | None = Header(None)):
    path = resolve_asset(request.app.state.settings.assets_dir, paper_id, filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    etag_value = hashlib.sha256(path.read_bytes()).hexdigest()
    etag = f'"{etag_value}"'
    headers = {"ETag": etag, "Cache-Control": "public, max-age=31536000, immutable"}
    if if_none_match == etag:
        return Response(status_code=304, headers=headers)
    return FileResponse(path, media_type="image/png", headers=headers)
