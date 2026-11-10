"""Database engine and schema management using SQLite3."""

import sqlite3
from contextlib import contextmanager
from typing import Generator
from backend.app.config import DB_PATH


def init_db() -> None:
    """Initialize database tables and indexes."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")

        # Papers table (TestBench CBT format)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS papers (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                exam TEXT NOT NULL,
                year INTEGER NOT NULL,
                duration_min INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                sections_count INTEGER NOT NULL,
                data_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Questions table (individual question index)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL,
                question_number INTEGER NOT NULL,
                question_id TEXT NOT NULL,
                section_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                type TEXT NOT NULL,
                content_json TEXT NOT NULL,
                options_json TEXT NOT NULL,
                answer_json TEXT NOT NULL,
                explanation_json TEXT NOT NULL,
                source_json TEXT NOT NULL,
                FOREIGN KEY (paper_id) REFERENCES papers (id) ON DELETE CASCADE
            );
        """)

        # Universal Q&A databases table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS qna_databases (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                exam_name TEXT NOT NULL,
                year INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Performance indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_questions_paper ON questions(paper_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(paper_id, subject);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_questions_num ON questions(paper_id, question_number);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_questions_qid ON questions(question_id);")
        conn.commit()


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for SQLite database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
    finally:
        conn.close()
