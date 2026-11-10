"""API Request and Response schemas."""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class PaperSummary(BaseModel):
    """Summary of a paper for library/catalog listings."""
    id: str
    title: str
    exam: str
    year: int
    durationMin: int
    totalQuestions: int
    sectionsCount: int
    badge: Optional[str] = None


class PaginatedQuestionsResponse(BaseModel):
    """Paginated list of Q&A questions."""
    page: int
    limit: int
    total: int
    totalPages: int
    questions: List[Dict[str, Any]]


class UploadResponse(BaseModel):
    """Response after PDF upload and pipeline processing."""
    success: bool
    paperId: str
    totalQuestions: int
    message: str
