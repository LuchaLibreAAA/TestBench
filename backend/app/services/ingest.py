"""Validate and ingest Universal Q&A files into the canonical SQLite store."""

import hashlib
import json
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

from pydantic import ValidationError

from backend.app.db import get_db
from backend.app.repositories.ingest_repo import replace_paper
from backend.app.settings import Settings, get_settings
from tools.pdf_qna_pipeline.models import QnADatabase

PAPER_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")


@dataclass
class IngestResult:
    """Outcome for one attempted paper ingestion."""

    paper_id: str | None
    status: str
    reason: str | None = None


def paper_id_for(raw: dict, source: Path) -> str:
    """Choose the declared paper ID or derive a stable kebab-case ID."""
    metadata = raw.get("examMetadata", {})
    declared = metadata.get("paperId")
    name = declared or "-".join(str(part) for part in (
        metadata.get("examName", "exam"), metadata.get("year", ""), metadata.get("session", ""), metadata.get("shift", "")
    ) if part).lower()
    paper_id = re.sub(r"[^a-z0-9]+", "-", name).strip("-")
    if not PAPER_RE.fullmatch(paper_id):
        raise ValueError("Derived paper ID is invalid")
    return paper_id


def ingest_file(path: Path, settings: Settings | None = None) -> IngestResult:
    """Validate one Q&A JSON, upsert it transactionally, then replace its assets."""
    config = settings or get_settings()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        paper_id = paper_id_for(raw, path)
        data = QnADatabase.model_validate(raw)
        canonical = data.model_dump(mode="json", by_alias=True)
        digest = hashlib.sha256(json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        with get_db(config) as connection:
            with connection:
                status = replace_paper(connection, paper_id, data, digest)
        if status != "unchanged":
            _replace_assets(path.parent / "images", config.assets_dir / paper_id)
        return IngestResult(paper_id, status)
    except (OSError, ValueError, ValidationError, json.JSONDecodeError) as exc:
        return IngestResult(None, "failed", str(exc))


def _replace_assets(source: Path, destination: Path) -> None:
    """Stage copied images beside the destination, then replace the paper asset folder."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent, prefix=".ingest-") as temp:
        staged = Path(temp) / "assets"
        staged.mkdir()
        if source.is_dir():
            for image in source.iterdir():
                if image.is_file() and image.suffix.lower() == ".png":
                    shutil.copy2(image, staged / image.name)
        backup = Path(temp) / "previous"
        if destination.exists():
            destination.replace(backup)
        staged.replace(destination)
        if backup.exists():
            shutil.rmtree(backup)


def seed_directory(directory: Path, settings: Settings | None = None) -> dict[str, int]:
    """Ingest every qna_database.json beneath a directory and return counts."""
    summary = {"inserted": 0, "updated": 0, "unchanged": 0, "failed": 0}
    for path in sorted(directory.rglob("qna_database.json")):
        result = ingest_file(path, settings)
        print(f"{result.paper_id or path}: {result.status}" + (f" ({result.reason})" if result.reason else ""))
        summary[result.status] += 1
    return summary
