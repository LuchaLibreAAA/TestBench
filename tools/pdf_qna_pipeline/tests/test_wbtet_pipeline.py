"""Unit and integrity tests for WBTET bilingual extraction and answer keys."""

import json
from pathlib import Path

from tools.pdf_qna_pipeline.answer_keys import parse_wbtet_answer_key
from tools.pdf_qna_pipeline.exporters.testbench import TestBenchExporter
from tools.pdf_qna_pipeline.models import QnADatabase
from tools.pdf_qna_pipeline.parsers.base import (
    PageRegion,
    ParsedOption,
    ParsedPaper,
    ParsedQuestion,
)
from tools.pdf_qna_pipeline.validate import run_all_validation_checks

ROOT = Path(__file__).resolve().parents[3]


def test_parse_wbtet_answer_keys_2022_and_2023():
    k22 = parse_wbtet_answer_key(
        ROOT / "tools/pdf_qna_pipeline/answer_keys_data/wbtet_2022_WBBPE_02B.json",
        expected_count=150,
    )
    k23 = parse_wbtet_answer_key(
        ROOT / "tools/pdf_qna_pipeline/answer_keys_data/wbtet_2023_A1_23.json",
        expected_count=150,
    )
    assert len(k22) == 150
    assert len(k23) == 150
    assert k22[1] == ["d"]
    assert k22[150] == ["d"]
    assert k23[1] == ["d"]
    assert k23[150] == ["c"]


def test_exporter_emits_localized_images_only_when_present():
    config = {
        "paper_id": "wbtet-unit",
        "exam_slug": "wbtet",
        "languages": ["en", "bn"],
        "duration_minutes": 150,
        "marking": {"single_choice": {"correct": 1, "wrong": 0, "unattempted": 0}},
        "sections": [
            {
                "id": "cdp",
                "name": "Child Development & Pedagogy",
                "subject": "CDP",
                "type": "single_choice",
                "q_range": [1, 1],
            }
        ],
    }
    reg_en = PageRegion(page=0, bbox=(10, 10, 100, 100))
    reg_bn = PageRegion(page=0, bbox=(110, 10, 200, 100))
    q1 = ParsedQuestion(
        question_number=1,
        question_id="wbtet-unit-q001",
        question_type="single_choice",
        section_id="cdp",
        subject="CDP",
        source_pages=[1],
        header_bbox=reg_en.bbox,
        statement_images=[reg_en, reg_bn],
        options=[
            ParsedOption(idx + 1, f"opt_{lbl}", lbl, 0, reg_en.bbox, text=f"Option {lbl.upper()}")
            for idx, lbl in enumerate(["a", "b", "c", "d"])
        ],
    )
    paper = ParsedPaper(
        exam_name="WBTET",
        total_questions=1,
        questions=[q1],
        raw_metadata={"localized_image_indices": {"wbtet-unit-q001": {"en": [0], "bn": [1]}}},
    )
    exporter = TestBenchExporter(config)
    tb = exporter.build_paper_dict(
        paper,
        {
            "questions": {
                "wbtet-unit-q001": [
                    "images/q_wbtet-unit-q001_part1.png",
                    "images/q_wbtet-unit-q001_part2.png",
                ]
            },
            "options": {},
        },
        initial_answers={1: "d"},
    )
    assert tb["languages"] == ["en", "bn"]
    exported_q = tb["sections"][0]["questions"][0]
    assert exported_q["localizedImages"] == {
        "en": ["q_wbtet-unit-q001_part1.png"],
        "bn": ["q_wbtet-unit-q001_part2.png"],
    }


def test_extracted_wbtet_datasets_pass_all_checks():
    for year in (2022, 2023):
        qna_path = ROOT / f"dist/qna/wbtet-{year}/qna_database.json"
        cfg_path = ROOT / f"tools/pdf_qna_pipeline/configs/wbtet_{year}.yaml"
        tb_path = ROOT / f"dist/qna/wbtet-{year}/testbench_paper.json"
        if not qna_path.exists():
            continue

        errs = run_all_validation_checks(qna_path, cfg_path)
        assert errs == [], f"Validation failed for {year}: {errs}"

        db = QnADatabase.model_validate_json(qna_path.read_text(encoding="utf-8"))
        assert db.examMetadata.totalQuestions == 150
        assert all(q.answer.isAnswerKeyAvailable for q in db.questions)

        tb = json.loads(tb_path.read_text(encoding="utf-8"))
        assert tb["exam"] == "wbtet"
        assert tb["languages"] == ["en", "bn"]
        assert len(tb["sections"]) == 5
