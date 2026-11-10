"""Tests for Stage 4 Validator."""

from pathlib import Path
from tools.pdf_qna_pipeline.validate import run_all_validation_checks

QNA_JSON = Path("dist/qna/jee-main-2026-shift2/qna_database.json")
CONFIG_YAML = Path("tools/pdf_qna_pipeline/configs/jee_main.yaml")


def test_validation_passes_all_8_hard_checks():
    """Verify that extracted qna_database.json passes all 8 hard checks."""
    assert QNA_JSON.exists(), f"Missing dataset: {QNA_JSON}"
    errors = run_all_validation_checks(QNA_JSON, CONFIG_YAML)
    assert len(errors) == 0, f"Validation errors found: {errors}"
