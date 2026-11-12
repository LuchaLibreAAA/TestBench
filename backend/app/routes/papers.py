"""API routes for test papers in TestBench CBT format."""

from typing import Any
from fastapi import APIRouter, HTTPException, Response, Request, Header
from typing import Dict
from backend.app.repositories.paper_repo import PaperRepository
from backend.app.models.api_models import PaperSummary, CatalogResponse

router = APIRouter(prefix="/papers", tags=["Papers"])


@router.get("", response_model=CatalogResponse)
def get_papers_catalog(request: Request):
    """List all available test papers."""
    return {"items": PaperRepository.list_papers(request.app.state.settings)}


@router.get("/{paper_id}", response_model=Dict[str, Any])
def get_paper_by_id(paper_id: str, request: Request, response: Response, if_none_match: str | None = Header(None)):
    """Retrieve full CBT paper structure in TestBench JSON format."""
    paper = PaperRepository.get_paper(paper_id, request.app.state.settings)
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found")
    content_hash, version = PaperRepository.paper_version(paper_id, request.app.state.settings)
    etag = f'"{content_hash}"'
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})
    response.headers["ETag"] = etag
    response.headers["X-Data-Version"] = str(version)
    return paper


@router.get("/{paper_id}/download")
def download_paper_json(paper_id: str, request: Request, if_none_match: str | None = Header(None)):
    """Download the paper as a JSON file."""
    import json
    paper = PaperRepository.get_paper(paper_id, request.app.state.settings)
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found")
    
    content_hash, version = PaperRepository.paper_version(paper_id, request.app.state.settings)
    etag = f'"{content_hash}"'
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})
    content = json.dumps(paper, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{paper_id}.json"', "ETag": etag, "X-Data-Version": str(version)},
    )
