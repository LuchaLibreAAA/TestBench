"""Repository for paper management in SQLite."""

import json
from typing import List, Optional, Dict, Any
from backend.app.database import get_db
from backend.app.models.api_models import PaperSummary


class PaperRepository:
    """Handles CRUD operations for test papers."""

    @staticmethod
    def save_paper(data: Dict[str, Any]) -> str:
        """Insert or replace a paper in SQLite."""
        paper_id = data["id"]
        title = data["title"]
        exam = data.get("exam", "jee-main")
        
        # Calculate year from tags or title or current
        year = 2026
        for tag in data.get("meta", {}).get("tags", []):
            if str(tag).isdigit() and len(str(tag)) == 4:
                year = int(tag)
                break

        duration_min = data.get("durationMin", 180)
        sections = data.get("sections", [])
        sections_count = len(sections)
        total_questions = sum(len(s.get("questions", [])) for s in sections)

        data_json = json.dumps(data)

        with get_db() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO papers 
                (id, title, exam, year, duration_min, total_questions, sections_count, data_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
                """,
                (paper_id, title, exam, year, duration_min, total_questions, sections_count, data_json),
            )
            conn.commit()

        return paper_id

    @staticmethod
    def get_paper(paper_id: str) -> Optional[Dict[str, Any]]:
        """Get complete paper JSON by paper ID."""
        with get_db() as conn:
            row = conn.execute(
                "SELECT data_json FROM papers WHERE id = ?;",
                (paper_id,),
            ).fetchone()

            if row:
                return json.loads(row["data_json"])
            return None

    @staticmethod
    def list_papers() -> List[PaperSummary]:
        """List all available papers as summaries."""
        with get_db() as conn:
            rows = conn.execute(
                """
                SELECT id, title, exam, year, duration_min, total_questions, sections_count 
                FROM papers 
                ORDER BY year DESC, id ASC;
                """
            ).fetchall()

            summaries = []
            for r in rows:
                summaries.append(
                    PaperSummary(
                        id=r["id"],
                        title=r["title"],
                        exam=r["exam"],
                        year=r["year"],
                        durationMin=r["duration_min"],
                        totalQuestions=r["total_questions"],
                        sectionsCount=r["sections_count"],
                        badge=f"{r['exam'].upper()} {r['year']}",
                    )
                )
            return summaries

    @staticmethod
    def delete_paper(paper_id: str) -> bool:
        """Delete a paper by ID."""
        with get_db() as conn:
            cur = conn.execute("DELETE FROM papers WHERE id = ?;", (paper_id,))
            conn.commit()
            return cur.rowcount > 0
