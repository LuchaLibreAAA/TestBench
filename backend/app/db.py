"""SQLite connection and versioned migration management."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from backend.app.settings import Settings, get_settings

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    """Open a configured SQLite connection with integrity and concurrency PRAGMAs."""
    path = db_path or get_settings().db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def migrate(settings: Settings | None = None) -> None:
    """Apply each numbered SQL migration once, recording it atomically."""
    config = settings or get_settings()
    with connect(config.db_path) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
        applied = {row[0] for row in connection.execute("SELECT version FROM schema_migrations")}
        for path in sorted(MIGRATIONS_DIR.glob("[0-9]*.sql")):
            version = int(path.name.split("_", 1)[0])
            if version in applied:
                continue
            connection.executescript(path.read_text(encoding="utf-8"))
            connection.execute("INSERT INTO schema_migrations(version, applied_at) VALUES (?, datetime('now'))", (version,))


@contextmanager
def get_db(settings: Settings | None = None) -> Generator[sqlite3.Connection, None, None]:
    """Yield a per-operation connection and always close it."""
    connection = connect((settings or get_settings()).db_path)
    try:
        yield connection
    finally:
        connection.close()
