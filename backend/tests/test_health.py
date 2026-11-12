"""Stage 1 checks for health, initial schema, and SQLite connection settings."""

import sqlite3

from fastapi.testclient import TestClient

from backend.app.db import connect
from backend.app.main import create_app
from backend.app.settings import Settings


def test_health_and_fresh_database(tmp_path):
    """App startup migrates a fresh DB and serves the versioned health response."""
    db_path = tmp_path / "api.db"
    settings = Settings(db_path=db_path, assets_dir=tmp_path / "assets", cors_origins=[])
    with TestClient(create_app(settings)) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "apiVersion": "v1", "dbOk": True}
    with connect(db_path) as connection:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')")}
        assert {"papers", "sections", "questions", "jobs", "questions_fts", "schema_migrations"} <= tables
        assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert connection.execute("PRAGMA journal_mode").fetchone()[0].lower() == "wal"
        assert connection.execute("PRAGMA synchronous").fetchone()[0] == 1
        assert connection.execute("PRAGMA busy_timeout").fetchone()[0] == 5000


def test_database_health_failure_is_reported(tmp_path):
    """Health reports unavailable DB without exposing SQLite internals."""
    settings = Settings(db_path=tmp_path / "missing" / "api.db", assets_dir=tmp_path / "assets", cors_origins=[])
    settings.db_path.parent.mkdir()
    settings.db_path.write_text("not a sqlite database", encoding="utf-8")
    response = TestClient(create_app(settings)).get("/api/v1/health")
    assert response.status_code == 503
    assert response.json() == {"status": "error", "apiVersion": "v1", "dbOk": False}
