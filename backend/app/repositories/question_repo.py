"""Repository for Q&A questions and universal Q&A databases."""

import json
from typing import List, Optional, Dict, Any, Tuple
from backend.app.database import get_db


class QuestionRepository:
    """Handles CRUD, indexing, and search queries for questions."""

    @staticmethod
    def save_qna_database(qna_id: str, data: Dict[str, Any]) -> str:
        """Store full Q&A database and index individual questions into SQLite."""
        meta = data.get("examMetadata", {})
        title = f"{meta.get('examName', 'Exam')} {meta.get('year', '')} {meta.get('shift', '')}".strip()
        exam_name = meta.get("examName", "JEE Main")
        year = meta.get("year", 2026)
        questions = data.get("questions", [])
        total_questions = len(questions)

        with get_db() as conn:
            # 1. Save to qna_databases table
            conn.execute(
                """
                INSERT OR REPLACE INTO qna_databases
                (id, title, exam_name, year, total_questions, data_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
                """,
                (qna_id, title, exam_name, year, total_questions, json.dumps(data)),
            )

            # 2. Index individual questions
            for q in questions:
                q_id = q["id"]
                conn.execute(
                    """
                    INSERT OR REPLACE INTO questions
                    (id, paper_id, question_number, question_id, section_id, subject, type,
                     content_json, options_json, answer_json, explanation_json, source_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        q_id,
                        qna_id,
                        q["questionNumber"],
                        q["questionId"],
                        q["sectionId"],
                        q["subject"],
                        q["type"],
                        json.dumps(q.get("content", {})),
                        json.dumps(q.get("options", [])),
                        json.dumps(q.get("answer", {})),
                        json.dumps(q.get("explanation", {})),
                        json.dumps(q.get("source", {})),
                    ),
                )
            conn.commit()

        return qna_id

    @staticmethod
    def get_qna_database(qna_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve complete Q&A database by ID."""
        with get_db() as conn:
            row = conn.execute(
                "SELECT data_json FROM qna_databases WHERE id = ?;",
                (qna_id,),
            ).fetchone()
            if row:
                return json.loads(row["data_json"])
            return None

    @staticmethod
    def query_questions(
        qna_id: Optional[str] = None,
        subject: Optional[str] = None,
        q_type: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 25,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Query indexed questions with filters, search, and pagination."""
        clauses = []
        params = []

        if qna_id:
            clauses.append("paper_id = ?")
            params.append(qna_id)

        if subject and subject.lower() != "all":
            clauses.append("LOWER(subject) = ?")
            params.append(subject.lower())

        if q_type and q_type.lower() != "all":
            if q_type == "mcq":
                clauses.append("type = 'single_choice'")
            elif q_type == "numeric":
                clauses.append("type = 'numeric'")
            else:
                clauses.append("type = ?")
                params.append(q_type)

        if search:
            search_str = f"%{search.strip().lower()}%"
            clauses.append(
                "(LOWER(question_id) LIKE ? OR question_number = ? OR LOWER(subject) LIKE ?)"
            )
            # Check if search is an integer for question_number
            q_num_val = int(search.strip().lstrip("qQ")) if search.strip().lstrip("qQ").isdigit() else -1
            params.extend([search_str, q_num_val, search_str])

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        with get_db() as conn:
            # Count total matching
            count_cur = conn.execute(f"SELECT COUNT(*) AS total FROM questions {where_sql};", params)
            total = count_cur.fetchone()["total"]

            # Query page
            offset = (page - 1) * limit
            query_sql = f"""
                SELECT id, paper_id, question_number, question_id, section_id, subject, type,
                       content_json, options_json, answer_json, explanation_json, source_json
                FROM questions
                {where_sql}
                ORDER BY question_number ASC
                LIMIT ? OFFSET ?;
            """
            rows = conn.execute(query_sql, params + [limit, offset]).fetchall()

            questions = []
            for r in rows:
                questions.append({
                    "id": r["id"],
                    "questionNumber": r["question_number"],
                    "questionId": r["question_id"],
                    "sectionId": r["section_id"],
                    "subject": r["subject"],
                    "type": r["type"],
                    "content": json.loads(r["content_json"]),
                    "options": json.loads(r["options_json"]),
                    "answer": json.loads(r["answer_json"]),
                    "explanation": json.loads(r["explanation_json"]),
                    "source": json.loads(r["source_json"]),
                })

            return questions, total
