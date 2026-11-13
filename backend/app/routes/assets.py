"""Serve validated paper assets with content-addressing, variants, and immutable cache validators."""

from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response, StreamingResponse

from backend.app.db import get_db
from backend.app.services.assets import resolve_asset
from backend.app.storage import get_storage

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("/{paper_id}/{filename}")
def get_image_asset(
    paper_id: str,
    filename: str,
    request: Request,
    w: Optional[int] = Query(None, description="Target image width variant (e.g. 480, 720, 1080)"),
    accept: Optional[str] = Header(None),
    if_none_match: Optional[str] = Header(None),
):
    settings = request.app.state.settings
    storage = get_storage(settings)
    accept_webp = bool(accept and "image/webp" in accept)

    with get_db(settings) as conn:
        resolved = resolve_asset(
            connection=conn,
            storage=storage,
            paper_id=paper_id,
            filename=filename,
            target_width=w,
            accept_webp=accept_webp,
            local_fallback_dir=settings.assets_dir,
        )

    if resolved is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    etag = f'"{resolved.sha256}"'
    headers = {
        "ETag": etag,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": str(resolved.bytes),
    }

    if if_none_match == etag:
        return Response(status_code=304, headers=headers)

    # If storage provides direct public URL (e.g. CDN or S3 public prefix)
    pub_url = storage.public_url(resolved.storage_key)
    if pub_url:
        return Response(status_code=307, headers={"Location": pub_url, **headers})

    if resolved.direct_path:
        return FileResponse(resolved.direct_path, media_type=resolved.content_type, headers=headers)

    return StreamingResponse(
        storage.open(resolved.storage_key),
        media_type=resolved.content_type,
        headers=headers,
    )
