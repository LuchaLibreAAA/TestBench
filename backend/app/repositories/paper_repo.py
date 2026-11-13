"""Read paper catalog data from the canonical SQLite store."""

from typing import Any
from backend.app.db import get_db
from backend.app.settings import Settings


class PaperRepository:
    """Queries papers and their indexed question data."""

    @staticmethod
    def get_paper(paper_id: str, settings: Settings | None = None) -> dict[str, Any] | None:
        """Build the TestBench-compatible paper JSON from canonical rows."""
        import json
        from backend.app.services.cbt_export import export_paper
        with get_db(settings) as conn:
            paper = conn.execute("SELECT * FROM papers WHERE id=?", (paper_id,)).fetchone()
            if paper is None:
                from pathlib import Path
                seed_cand = Path(__file__).resolve().parent.parent.parent / "seeds" / "papers" / f"{paper_id}.json"
                if seed_cand.is_file():
                    try:
                        return json.loads(seed_cand.read_text(encoding="utf-8"))
                    except Exception:
                        pass
                return None
            sections = conn.execute("SELECT * FROM sections WHERE paper_id=? ORDER BY position", (paper_id,)).fetchall()
            questions = conn.execute("SELECT * FROM questions WHERE paper_id=? ORDER BY question_number", (paper_id,)).fetchall()
        return export_paper(paper_id, paper, sections, questions)

    @staticmethod
    def paper_version(paper_id: str, settings: Settings | None = None) -> tuple[str, int] | None:
        """Return canonical content hash and version for cache headers."""
        with get_db(settings) as conn:
            row = conn.execute("SELECT content_hash,data_version FROM papers WHERE id=?", (paper_id,)).fetchone()
        if not row:
            from pathlib import Path
            seed_cand = Path(__file__).resolve().parent.parent.parent / "seeds" / "papers" / f"{paper_id}.json"
            if seed_cand.is_file():
                return ("seed-v1", 1)
            return None
        return (row["content_hash"], row["data_version"])

    @staticmethod
    def list_papers(settings: Settings | None = None) -> list[dict[str, Any]]:
        """List papers in catalog-summary format."""
        with get_db(settings) as conn:
            rows = conn.execute(
                """
                SELECT p.id, p.title, p.exam, p.year, p.duration_min, p.total_questions,
                       (SELECT COUNT(*) FROM sections s WHERE s.paper_id=p.id) AS sections_count
                FROM papers p
                ORDER BY year DESC, id ASC;
                """
            ).fetchall()

            return [dict(id=r["id"], title=r["title"], exam=r["exam"], year=r["year"],
                         durationMin=r["duration_min"], totalQuestions=r["total_questions"],
                         sectionsCount=r["sections_count"], badge=f"{r['exam'].upper()} {r['year']}") for r in rows]

    @staticmethod
    def delete_paper(paper_id: str, settings: Settings | None = None) -> bool:
        """Delete a paper and its dependent rows."""
        with get_db(settings) as conn:
            conn.execute("DELETE FROM questions_fts WHERE paper_id=?", (paper_id,))
            cur = conn.execute("DELETE FROM papers WHERE id = ?;", (paper_id,))
            conn.commit()
            return cur.rowcount > 0
