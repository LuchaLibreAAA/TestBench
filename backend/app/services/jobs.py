"""Background PDF extraction job lifecycle."""

import asyncio
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

from backend.app.db import get_db
from backend.app.services.ingest import ingest_file
from backend.app.settings import Settings

_pipeline_lock = asyncio.Lock()
_TIMEOUT_SECONDS = 600


def create_job(settings: Settings, job_id: str) -> None:
    with get_db(settings) as conn:
        conn.execute("INSERT INTO jobs(id,status) VALUES(?, 'queued')", (job_id,))


def get_job(settings: Settings, job_id: str) -> dict | None:
    with get_db(settings) as conn:
        row = conn.execute("SELECT status,paper_id,error FROM jobs WHERE id=?", (job_id,)).fetchone()
    return {"status": row["status"], "paperId": row["paper_id"], "error": row["error"]} if row else None


async def run_upload_job(settings: Settings, job_id: str, job_dir: Path, config_name: str) -> None:
    async with _pipeline_lock:
        await asyncio.to_thread(_run_pipeline, settings, job_id, job_dir, config_name)


def _run_pipeline(settings: Settings, job_id: str, job_dir: Path, config_name: str) -> None:
    try:
        with get_db(settings) as conn:
            conn.execute("UPDATE jobs SET status='running' WHERE id=?", (job_id,))
        pdfs = list(job_dir.glob("*.pdf"))
        if len(pdfs) != 1:
            raise ValueError("Uploaded PDF missing")
        config_dir = Path("tools/pdf_qna_pipeline/configs").resolve()
        config = (config_dir / f"{config_name}.yaml").resolve()
        if config.parent != config_dir or not config.is_file():
            raise ValueError("Unknown extraction config")
        output = job_dir / "result"
        subprocess.run([sys.executable, "-m", "tools.pdf_qna_pipeline.cli", "extract", "--input", str(pdfs[0]), "--output", str(output), "--config", str(config)],
                       check=True, timeout=_TIMEOUT_SECONDS, capture_output=True, text=True, cwd=Path.cwd())
        result = ingest_file(output / "qna_database.json", settings)
        if result.status not in ("inserted", "updated", "unchanged"):
            raise ValueError(result.reason or "Ingestion failed")
        with get_db(settings) as conn:
            conn.execute("UPDATE jobs SET status='done',paper_id=?,finished_at=datetime('now') WHERE id=?", (result.paper_id, job_id))
    except (OSError, subprocess.SubprocessError, ValueError, sqlite3.Error) as exc:
        with get_db(settings) as conn:
            conn.execute("UPDATE jobs SET status='failed',error=?,finished_at=datetime('now') WHERE id=?", (str(exc)[:500], job_id))
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)
