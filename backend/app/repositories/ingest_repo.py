"""SQL operations for replacing canonical paper, section, and question rows."""

import json
import sqlite3
from typing import Any

from tools.pdf_qna_pipeline.models import QnADatabase


def replace_paper(connection: sqlite3.Connection, paper_id: str, data: QnADatabase, content_hash: str) -> str:
    """Insert or replace a complete paper atomically, returning inserted or updated."""
    meta = data.examMetadata
    existing = connection.execute("SELECT content_hash, data_version FROM papers WHERE id = ?", (paper_id,)).fetchone()
    if existing and existing["content_hash"] == content_hash:
        return "unchanged"
    version = 1 if existing is None else existing["data_version"] + 1
    connection.execute(
        """INSERT INTO papers(id,title,exam,year,total_questions,duration_min,exam_metadata_json,data_version,content_hash)
           VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, exam=excluded.exam,
           year=excluded.year, total_questions=excluded.total_questions, duration_min=excluded.duration_min,
           exam_metadata_json=excluded.exam_metadata_json, data_version=excluded.data_version,
           content_hash=excluded.content_hash, updated_at=datetime('now')""",
        (paper_id, f"{meta.examName} {meta.year}", meta.examName, meta.year, meta.totalQuestions,
         meta.durationMinutes, _json(meta.model_dump(mode="json", by_alias=True)), version, content_hash),
    )
    connection.execute("DELETE FROM questions WHERE paper_id = ?", (paper_id,))
    connection.execute("DELETE FROM sections WHERE paper_id = ?", (paper_id,))
    connection.execute("DELETE FROM questions_fts WHERE paper_id = ?", (paper_id,))
    for position, section in enumerate(data.sections):
        connection.execute(
            "INSERT INTO sections VALUES(?,?,?,?,?,?,?)",
            (paper_id, section.sectionId, section.sectionName, section.subject, section.questionType,
             _json(section.markingScheme.model_dump(mode="json")), position),
        )
    for question in data.questions:
        connection.execute(
            """INSERT INTO questions(id,paper_id,question_number,question_id,section_id,subject,type,
               content_json,options_json,answer_json,explanation_json,source_json)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
            (f"{paper_id}:{question.questionId}", paper_id, question.questionNumber, question.questionId,
             question.sectionId, question.subject, question.type, _json(question.content.model_dump(mode="json")),
             _json([option.model_dump(mode="json") for option in question.options]),
             _json(question.answer.model_dump(mode="json")), _json(question.explanation.model_dump(mode="json")),
             _json(question.source.model_dump(mode="json"))),
        )
        connection.execute("INSERT INTO questions_fts(question_id,paper_id,body) VALUES(?,?,?)", (question.questionId, paper_id, question.content.text))
    return "inserted" if existing is None else "updated"


def _json(value: Any) -> str:
    """Serialize values deterministically for database storage."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
