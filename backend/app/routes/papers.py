"""API routes for test papers in TestBench CBT format."""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Response
from backend.app.repositories.paper_repo import PaperRepository
from backend.app.models.api_models import PaperSummary

router = APIRouter(prefix="/papers", tags=["Papers"])


@router.get("", response_model=List[PaperSummary])
def get_papers_catalog():
    """List all available test papers."""
    return PaperRepository.list_papers()


@router.get("/{paper_id}", response_model=Dict[str, Any])
def get_paper_by_id(paper_id: str):
    """Retrieve full CBT paper structure in TestBench JSON format."""
    paper = PaperRepository.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found")
    return paper


@router.get("/{paper_id}/download")
def download_paper_json(paper_id: str):
    """Download the paper as a JSON file."""
    import json
    paper = PaperRepository.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found")
    
    content = json.dumps(paper, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{paper_id}.json"'},
    )
