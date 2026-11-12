"""Tests for NEET UG extraction, validation, and official answer key mapping."""

from pathlib import Path
import json

from tools.pdf_qna_pipeline.answer_keys import _normalize_nta_response
from tools.pdf_qna_pipeline.validate import run_all_validation_checks


def test_normalize_nta_response_codes():
    assert _normalize_nta_response("1") == ["a"]
    assert _normalize_nta_response("4") == ["d"]
    assert _normalize_nta_response("B") == ["a", "c"]
    assert _normalize_nta_response("E") == ["b", "d"]
    assert _normalize_nta_response("5") == ["a", "b", "c", "d"]
    assert _normalize_nta_response("1,2") == ["a", "b"]


def test_all_neet_qna_datasets_pass_validation():
    for yr, expected_qs in [(2023, 200), (2024, 200), (2025, 180), (2026, 180)]:
        qna_path = Path(f"dist/qna/neet-ug-{yr}/qna_database.json")
        cfg_path = Path(f"tools/pdf_qna_pipeline/configs/neet_{yr}.yaml")
        assert qna_path.exists(), f"Missing {qna_path}"
        errors = run_all_validation_checks(qna_path, cfg_path)
        assert errors == [], f"Validation errors for NEET {yr}: {errors}"

        data = json.loads(qna_path.read_text(encoding="utf-8"))
        assert len(data["questions"]) == expected_qs
        assert all(q["answer"]["isAnswerKeyAvailable"] is True for q in data["questions"])
        if yr == 2026:
            raw_lower = qna_path.read_text(encoding="utf-8").lower()
            assert "examgoal" not in raw_lower
            assert "examside" not in raw_lower
