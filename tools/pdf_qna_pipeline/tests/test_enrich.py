"""Tests for Stage 5 Enricher."""

from pathlib import Path
from tools.pdf_qna_pipeline.enrich.null_enricher import NullEnricher


def test_null_enricher_returns_empty_string():
    """Verify NullEnricher returns empty string for any image path."""
    enricher = NullEnricher()
    dummy_path = Path("dist/qna/jee-main-2026-shift2/images/q_691121151.png")
    result = enricher.enrich_image(dummy_path)
    assert result == ""
