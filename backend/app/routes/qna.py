"""API routes for universal Q&A database and question bank querying."""

import math
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Request, Header, Response
from backend.app.repositories.question_repo import QuestionRepository
from backend.app.models.api_models import PaginatedQuestionsResponse

router = APIRouter(prefix="/qna", tags=["Q&A Database"])


@router.get("/{qna_id}", response_model=Dict[str, Any])
def get_universal_qna_database(qna_id: str, request: Request, response: Response, if_none_match: str | None = Header(None)):
    """Retrieve full universal Q&A database JSON."""
    db_data = QuestionRepository.get_qna_database(qna_id, request.app.state.settings)
    if not db_data:
        raise HTTPException(status_code=404, detail=f"Q&A database '{qna_id}' not found")
    from backend.app.repositories.paper_repo import PaperRepository
    version = PaperRepository.paper_version(qna_id, request.app.state.settings)
    etag = f'"{version[0]}"'
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})
    response.headers["ETag"] = etag
    response.headers["X-Data-Version"] = str(version[1])
    return db_data


@router.get("/{qna_id}/questions", response_model=PaginatedQuestionsResponse)
def search_and_filter_questions(
    qna_id: str,
    request: Request,
    response: Response,
    subject: Optional[str] = Query(None, description="Subject filter: Mathematics, Physics, Chemistry, etc."),
    type: Optional[str] = Query(None, description="Question type filter: single_choice or numeric"),
    section: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by question number (e.g. 15) or Question ID"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
):
    """Query questions with filters, search keywords, and pagination."""
    try:
        questions, total = QuestionRepository.query_questions(
            qna_id=qna_id,
            subject=subject,
            q_type=type,
            section=section,
            search=search,
            page=page,
            limit=limit,
            settings=request.app.state.settings,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail=f"Q&A database '{qna_id}' not found")
    total_pages = max(1, math.ceil(total / limit)) if total > 0 else 1

    return PaginatedQuestionsResponse(
        page=page,
        limit=limit,
        total=total,
        pages=total_pages,
        items=questions,
    )


@router.get("/{qna_id}/questions/{q_num}", response_model=Dict[str, Any])
def get_single_question(qna_id: str, q_num: int, request: Request):
    """Fetch a single question by question number."""
    try:
        questions, total = QuestionRepository.query_questions(
            qna_id=qna_id,
            search=str(q_num),
            page=1,
            limit=5,
            settings=request.app.state.settings,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail=f"Q&A database '{qna_id}' not found")
    matched = next((q for q in questions if q["questionNumber"] == q_num), None)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Question {q_num} not found in '{qna_id}'")
    return matched
