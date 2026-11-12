"""Stage 2 checks for atomic, repeatable ingestion and seeding."""

import base64
import json
import shutil
from pathlib import Path

from backend.app.db import connect, migrate
from backend.app.services.ingest import ingest_file, seed_directory
from backend.app.settings import Settings

FIXTURE = Path(__file__).parent / "fixtures" / "mini_paper"
PNG_1X1 = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=")


def setup_paper(tmp_path):
    """Copy the tiny valid paper and materialize its two PNG fixtures."""
    source = tmp_path / "qna" / "mini-paper"
    (source / "images").mkdir(parents=True)
    shutil.copy(FIXTURE / "qna_database.json", source / "qna_database.json")
    (source / "images" / "q_101.png").write_bytes(PNG_1X1)
    (source / "images" / "opt_101_1.png").write_bytes(PNG_1X1)
    return source


def test_seed_insert_then_unchanged(tmp_path, capsys):
    """Repeated seeding is idempotent and copies paper assets."""
    source = setup_paper(tmp_path)
    settings = Settings(db_path=tmp_path / "api.db", assets_dir=tmp_path / "assets", cors_origins=[])
    migrate(settings)
    assert seed_directory(source.parent, settings) == {"inserted": 1, "updated": 0, "unchanged": 0, "failed": 0}
    assert seed_directory(source.parent, settings) == {"inserted": 0, "updated": 0, "unchanged": 1, "failed": 0}
    assert (settings.assets_dir / "mini-exam-2025-may-shift-1" / "q_101.png").read_bytes() == PNG_1X1
    assert "mini-exam-2025-may-shift-1" in capsys.readouterr().out


def test_changed_content_increments_version(tmp_path):
    """A content change replaces rows and increments data_version exactly once."""
    source = setup_paper(tmp_path)
    settings = Settings(db_path=tmp_path / "api.db", assets_dir=tmp_path / "assets", cors_origins=[])
    migrate(settings)
    assert ingest_file(source / "qna_database.json", settings).status == "inserted"
    path = source / "qna_database.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    raw["questions"][0]["content"]["text"] = "changed"
    path.write_text(json.dumps(raw), encoding="utf-8")
    assert ingest_file(path, settings).status == "updated"
    with connect(settings.db_path) as connection:
        paper = connection.execute("SELECT data_version FROM papers").fetchone()
        assert paper[0] == 2
        question = connection.execute("SELECT content_json FROM questions WHERE question_id='101'").fetchone()
        assert json.loads(question[0])["text"] == "changed"


def test_corrupt_json_fails_without_partial_rows(tmp_path):
    """Invalid JSON leaves the canonical tables untouched."""
    source = setup_paper(tmp_path)
    settings = Settings(db_path=tmp_path / "api.db", assets_dir=tmp_path / "assets", cors_origins=[])
    migrate(settings)
    corrupt = source / "broken.json"
    corrupt.write_text("{broken", encoding="utf-8")
    result = ingest_file(corrupt, settings)
    assert result.status == "failed"
    with connect(settings.db_path) as connection:
        assert connection.execute("SELECT count(*) FROM papers").fetchone()[0] == 0
        assert connection.execute("SELECT count(*) FROM sections").fetchone()[0] == 0
        assert connection.execute("SELECT count(*) FROM questions").fetchone()[0] == 0
