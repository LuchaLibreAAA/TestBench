"""Queries canonical paper and question records."""

import json
from typing import Any

from backend.app.db import get_db
from backend.app.settings import Settings


class QuestionRepository:
    """Read full Q&A exports and filtered question pages."""

    @staticmethod
    def get_qna_database(qna_id: str, settings: Settings | None = None) -> dict[str, Any] | None:
        """Rebuild the versioned Q&A export shape from normalized rows."""
        with get_db(settings) as conn:
            paper = conn.execute("SELECT * FROM papers WHERE id=?", (qna_id,)).fetchone()
            if paper is None:
                return None
            sections = conn.execute(
                "SELECT * FROM sections WHERE paper_id=? ORDER BY position", (qna_id,)
            ).fetchall()
            questions = conn.execute(
                "SELECT * FROM questions WHERE paper_id=? ORDER BY question_number", (qna_id,)
            ).fetchall()
        metadata = json.loads(paper["exam_metadata_json"])
        return {
            "schemaVersion": "1.0",
            "examMetadata": metadata,
            "sections": [{"sectionId": s["section_id"], "sectionName": s["section_name"],
                          "subject": s["subject"], "questionType": s["question_type"],
                          "markingScheme": json.loads(s["marking_json"])} for s in sections],
            "questions": [QuestionRepository._question(q) for q in questions],
        }

    @staticmethod
    def query_questions(qna_id: str | None = None, subject: str | None = None,
                        q_type: str | None = None, search: str | None = None,
                        section: str | None = None,
                        page: int = 1, limit: int = 25,
                        settings: Settings | None = None) -> tuple[list[dict[str, Any]], int]:
        """Filter and paginate questions, using FTS for textual search."""
        conditions: list[str] = []
        params: list[Any] = []
        if qna_id:
            conditions.append("q.paper_id=?")
            params.append(qna_id)
        if subject and subject.lower() != "all":
            conditions.append("LOWER(q.subject)=?")
            params.append(subject.lower())
        if q_type and q_type.lower() != "all":
            normalized = {"mcq": "single_choice", "numeric": "numeric"}.get(q_type.lower(), q_type)
            conditions.append("q.type=?")
            params.append(normalized)
        if section:
            conditions.append("q.section_id=?")
            params.append(section)
        if search:
            term = search.strip()
            number = int(term.lstrip("qQ")) if term.lstrip("qQ").isdigit() else -1
            conditions.append("(q.question_number=? OR LOWER(q.question_id) LIKE ? OR q.question_id IN (SELECT question_id FROM questions_fts WHERE questions_fts MATCH ? AND paper_id=?))")
            params.extend([number, f"%{term.lower()}%", _fts_query(term), qna_id or ""])
        where = " WHERE " + " AND ".join(conditions) if conditions else ""
        with get_db(settings) as conn:
            if qna_id and conn.execute("SELECT 1 FROM papers WHERE id=?", (qna_id,)).fetchone() is None:
                raise LookupError(qna_id)
            total = conn.execute(f"SELECT COUNT(*) FROM questions q{where}", params).fetchone()[0]
            rows = conn.execute(f"SELECT q.* FROM questions q{where} ORDER BY q.question_number LIMIT ? OFFSET ?",
                                [*params, limit, (page - 1) * limit]).fetchall()
        return [QuestionRepository._question(row) for row in rows], total

    @staticmethod
    def _question(row: Any) -> dict[str, Any]:
        return {"id": f"q-{row['question_id']}", "questionNumber": row["question_number"], "questionId": row["question_id"],
                "sectionId": row["section_id"], "subject": row["subject"], "type": row["type"],
                "content": json.loads(row["content_json"]), "options": json.loads(row["options_json"]),
                "answer": json.loads(row["answer_json"]), "explanation": json.loads(row["explanation_json"]),
                "source": json.loads(row["source_json"])}


def _fts_query(value: str) -> str:
    """Quote user input as an FTS phrase instead of accepting FTS operators."""
    return '"' + value.replace('"', '""') + '"'
