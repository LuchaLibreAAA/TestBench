"""Tests for database migrations 001 and 002."""

import sqlite3
from pathlib import Path
from backend.app.db import MIGRATIONS_DIR, migrate
from backend.app.settings import Settings


def test_migrations_fresh_db(tmp_path: Path):
    db_file = tmp_path / "fresh.db"
    settings = Settings(db_path=db_file, admin_token="test", allow_insecure_dev=True)
    migrate(settings)

    with sqlite3.connect(db_file) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        assert "schema_migrations" in tables
        assert "exams" in tables
        assert "papers" in tables
        assert "sections" in tables
        assert "questions" in tables
        assert "assets" in tables
        assert "asset_variants" in tables
        assert "paper_packages" in tables

        # Verify default exams
        cursor.execute("SELECT code, name FROM exams ORDER BY position")
        exams = cursor.fetchall()
        codes = [e[0] for e in exams]
        assert "jee-main" in codes
        assert "neet-ug" in codes
        assert "wbtet" in codes


def test_migration_upgrade_from_001(tmp_path: Path):
    db_file = tmp_path / "upgrade.db"

    # 1. Apply only 001
    with sqlite3.connect(db_file) as conn:
        init_sql = (MIGRATIONS_DIR / "001_init.sql").read_text(encoding="utf-8")
        conn.executescript(init_sql)
        conn.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'))")

        # Insert legacy paper and question
        conn.execute(
            """INSERT INTO papers (id, title, exam, year, total_questions, duration_min, exam_metadata_json, content_hash)
               VALUES ('test-paper-1', 'Test Paper', 'JEE Main', 2024, 1, 180, '{}', 'hash123')"""
        )
        conn.execute(
            """INSERT INTO sections (paper_id, section_id, section_name, subject, question_type, marking_json, position)
               VALUES ('test-paper-1', 'sec-1', 'Sec 1', 'Physics', 'single_choice', '{"correct":4,"wrong":-1}', 1)"""
        )
        conn.execute(
            """INSERT INTO questions (id, paper_id, question_number, question_id, section_id, subject, type, content_json, options_json, answer_json, source_json)
               VALUES ('q1', 'test-paper-1', 1, '1001', 'sec-1', 'Physics', 'single_choice', '{"text":"Q1"}', '[]', '{"value":"1"}', '{}')"""
        )

    # 2. Run migrate() which will apply 002
    settings = Settings(db_path=db_file, admin_token="test", allow_insecure_dev=True)
    migrate(settings)

    with sqlite3.connect(db_file) as conn:
        cursor = conn.cursor()
        # Check papers exam_code backfill
        cursor.execute("SELECT exam_code, status, schema_version FROM papers WHERE id='test-paper-1'")
        row = cursor.fetchone()
        assert row[0] == "jee-main"
        assert row[1] == "published"
        assert row[2] == "1.0"

        # Check question was preserved
        cursor.execute("SELECT id, type, content_blocks_json FROM questions WHERE id='q1'")
        q_row = cursor.fetchone()
        assert q_row[0] == "q1"
        assert q_row[1] == "single_choice"
        assert q_row[2] == "[]"

        # Check new question types can be inserted now
        cursor.execute(
            """INSERT INTO questions (id, paper_id, question_number, question_id, section_id, subject, type, content_json, options_json, answer_json, source_json)
               VALUES ('q2', 'test-paper-1', 2, '1002', 'sec-1', 'Physics', 'multi_choice', '{"text":"Q2"}', '[]', '{"value":["1","2"]}', '{}')"""
        )
        cursor.execute(
            """INSERT INTO questions (id, paper_id, question_number, question_id, section_id, subject, type, content_json, options_json, answer_json, source_json)
               VALUES ('q3', 'test-paper-1', 3, '1003', 'sec-1', 'Physics', 'true_false', '{"text":"Q3"}', '[]', '{"value":"true"}', '{}')"""
        )
        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM questions WHERE paper_id='test-paper-1'")
        assert cursor.fetchone()[0] == 3
