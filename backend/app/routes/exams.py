"""API routes for exam registry."""

import json
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Request

from backend.app.db import get_db
from backend.app.models.api_models import ExamSummary

router = APIRouter(prefix="/exams", tags=["Exams"])


@router.get("", response_model=List[ExamSummary])
def list_exams(request: Request):
    """List all active exams with paper counts."""
    settings = request.app.state.settings
    with get_db(settings) as conn:
        rows = conn.execute(
            """SELECT e.code, e.name, e.badge, e.default_marking_strategy, e.position, e.active,
                      (SELECT COUNT(*) FROM papers p WHERE p.exam_code = e.code AND p.status = 'published') AS papers_count
               FROM exams e
               WHERE e.active = 1
               ORDER BY e.position ASC, e.name ASC"""
        ).fetchall()

        return [
            ExamSummary(
                code=r["code"],
                name=r["name"],
                badge=r["badge"] or r["name"],
                defaultMarkingStrategy=r["default_marking_strategy"],
                position=r["position"],
                active=r["active"],
                papersCount=r["papers_count"],
            )
            for r in rows
        ]


@router.get("/{code}")
def get_exam(code: str, request: Request) -> Dict[str, Any]:
    """Get exam details and its published papers."""
    settings = request.app.state.settings
    with get_db(settings) as conn:
        row = conn.execute(
            """SELECT code, name, badge, default_marking_strategy, pipeline_config, config_json, position, active
               FROM exams WHERE code = ?""",
            (code,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Exam '{code}' not found")

        papers = conn.execute(
            """SELECT id, title, exam, year, duration_min, total_questions
               FROM papers
               WHERE exam_code = ? AND status = 'published'
               ORDER BY year DESC, id ASC""",
            (code,),
        ).fetchall()

        config = {}
        if row["config_json"]:
            try:
                config = json.loads(row["config_json"])
            except Exception:
                pass

        return {
            "code": row["code"],
            "name": row["name"],
            "badge": row["badge"] or row["name"],
            "defaultMarkingStrategy": row["default_marking_strategy"],
            "pipelineConfig": row["pipeline_config"],
            "config": config,
            "position": row["position"],
            "active": row["active"],
            "papers": [
                {
                    "id": p["id"],
                    "title": p["title"],
                    "year": p["year"],
                    "durationMin": p["duration_min"],
                    "totalQuestions": p["total_questions"],
                }
                for p in papers
            ],
        }
