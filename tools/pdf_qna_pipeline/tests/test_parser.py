"""Tests for the Stage 2 NTA CBT Parser."""

import json
from pathlib import Path
import pymupdf
import pytest

from tools.pdf_qna_pipeline.config import load_config
from tools.pdf_qna_pipeline.parsers.nta_cbt import NtaCbtParser

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "expected_sample.json"
PDF_PATH = Path("testbench/Jee main 2026/JEE-Main-2026-Question-Paper-B-Tech-2nd-Apr-Shift-2.pdf")
CONFIG_PATH = Path("tools/pdf_qna_pipeline/configs/jee_main.yaml")


def test_parser_returns_75_contiguous_questions():
    """Verify parser returns exactly 75 contiguous questions numbered 1..75."""
    assert PDF_PATH.exists(), f"PDF file missing: {PDF_PATH}"
    config = load_config(CONFIG_PATH)
    parser = NtaCbtParser(config)

    doc = pymupdf.open(str(PDF_PATH))
    paper = parser.parse(doc)

    assert paper.total_questions == 75
    assert len(paper.questions) == 75

    # Check contiguous numbers 1..75
    q_numbers = [q.question_number for q in paper.questions]
    assert q_numbers == list(range(1, 76))

    # Check question types count: 60 single_choice, 15 numeric
    mcqs = [q for q in paper.questions if q.question_type == "single_choice"]
    numerics = [q for q in paper.questions if q.question_type == "numeric"]
    assert len(mcqs) == 60
    assert len(numerics) == 15

    # Verify every MCQ has 4 options and numeric has 0
    for q in mcqs:
        assert len(q.options) == 4, f"Q{q.question_number} has {len(q.options)} options instead of 4"
        assert len(q.statement_images) >= 1, f"Q{q.question_number} has no statement images"
        for opt in q.options:
            assert opt.image_region is not None, f"Q{q.question_number} opt {opt.option_id} has no image_region"

    for q in numerics:
        assert len(q.options) == 0, f"Numeric Q{q.question_number} has options"
        assert len(q.statement_images) >= 1, f"Q{q.question_number} has no statement images"


def test_parser_matches_expected_sample_fixtures():
    """Verify parser matches the 5 hand-crafted fixture questions."""
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        fixtures = json.load(f)

    config = load_config(CONFIG_PATH)
    parser = NtaCbtParser(config)
    doc = pymupdf.open(str(PDF_PATH))
    paper = parser.parse(doc)

    q_by_num = {q.question_number: q for q in paper.questions}

    for expected in fixtures:
        q_num = expected["questionNumber"]
        assert q_num in q_by_num, f"Question {q_num} not found in parsed questions"
        actual = q_by_num[q_num]

        assert actual.question_id == expected["questionId"]
        assert actual.question_type == expected["type"]
        assert actual.section_id == expected["sectionId"]
        assert len(actual.options) == expected["optionCount"]

        if expected["optionCount"] > 0:
            actual_opt_ids = [opt.option_id for opt in actual.options]
            assert actual_opt_ids == expected["optionIds"]
