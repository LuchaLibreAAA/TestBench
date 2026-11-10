"""API routes for universal Q&A database and question bank querying."""

import math
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from backend.app.repositories.question_repo import QuestionRepository
from backend.app.models.api_models import PaginatedQuestionsResponse

router = APIRouter(prefix="/qna", tags=["Q&A Database"])


@router.get("/{qna_id}", response_model=Dict[str, Any])
def get_universal_qna_database(qna_id: str):
    """Retrieve full universal Q&A database JSON."""
    db_data = QuestionRepository.get_qna_database(qna_id)
    if not db_data:
        raise HTTPException(status_code=404, detail=f"Q&A database '{qna_id}' not found")
    return db_data


@router.get("/{qna_id}/questions", response_model=PaginatedQuestionsResponse)
def search_and_filter_questions(
    qna_id: str,
    subject: Optional[str] = Query(None, description="Subject filter: Mathematics, Physics, Chemistry, etc."),
    type: Optional[str] = Query(None, description="Question type filter: mcq or numeric"),
    search: Optional[str] = Query(None, description="Search by question number (e.g. 15) or Question ID"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
):
    """Query questions with filters, search keywords, and pagination."""
    questions, total = QuestionRepository.query_questions(
        qna_id=qna_id,
        subject=subject,
        q_type=type,
        search=search,
        page=page,
        limit=limit,
    )
    total_pages = max(1, math.ceil(total / limit)) if total > 0 else 1

    return PaginatedQuestionsResponse(
        page=page,
        limit=limit,
        total=total,
        totalPages=total_pages,
        questions=questions,
    )


@router.get("/{qna_id}/questions/{q_num}", response_model=Dict[str, Any])
def get_single_question(qna_id: str, q_num: int):
    """Fetch a single question by question number."""
    questions, total = QuestionRepository.query_questions(
        qna_id=qna_id,
        search=str(q_num),
        page=1,
        limit=5,
    )
    matched = next((q for q in questions if q["questionNumber"] == q_num), None)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Question {q_num} not found in '{qna_id}'")
    return matched
