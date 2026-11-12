"""
Command Line Interface for PDF-to-QnA Extraction Pipeline.
Subcommands:
  - inspect: Analyze PDF structure, extract page/image/text profile and facts.
  - extract: Extract questions, options, bboxes and images into dataset.
  - validate: Run strict consistency, schema and file integrity checks.
  - export: Convert dataset to TestBench or other target formats.
  - enrich: Optional OCR/LaTeX text enrichment.
"""

import argparse
import json
import re
import sys
from pathlib import Path
import pymupdf

from tools.pdf_qna_pipeline.config import load_config
from tools.pdf_qna_pipeline.parsers.nta_cbt import NtaCbtParser
from tools.pdf_qna_pipeline.parsers.neet_scanned import NeetScannedParser
from tools.pdf_qna_pipeline.parsers.examgoal_neet import ExamGoalNeetParser
from tools.pdf_qna_pipeline.parsers.wbtet_scanned import WbtetScannedParser
from tools.pdf_qna_pipeline.answer_keys import (
    generate_random_answers,
    parse_2023_answer_key,
    parse_2024_or_2025_answer_key,
    parse_2026_pdf_answer_key,
    parse_wbtet_answer_key,
    apply_answers_to_datasets,
)
from tools.pdf_qna_pipeline.extractors.image_clipper import ImageClipper
from tools.pdf_qna_pipeline.exporters.universal_qna import UniversalQnAExporter
from tools.pdf_qna_pipeline.exporters.testbench import TestBenchExporter
from tools.pdf_qna_pipeline.validate import run_all_validation_checks


def run_inspect(pdf_path: Path, output_dir: Path) -> dict:
    """Stage 0: Inspect the PDF and record facts into pdf_profile.json."""
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(str(pdf_path))

    profile = {
        "summary": "",
        "sourcePdf": str(pdf_path.name),
        "pageCount": len(doc),
        "pages": [],
        "candidateMatches": {
            "sectionHeaders": [],
            "questionHeaders": [],
            "questionTypes": [],
            "optionIds": [],
        },
        "sampleRawText": {
            "page1First40Lines": [],
            "page2First40Lines": [],
        },
    }

    sec_re = re.compile(r"^\s*(Mathematics|Physics|Chemistry)\s+Section\s+([AB])", re.MULTILINE)
    q_re = re.compile(r"Question Number\s*:\s*(\d+)\s+Question Id\s*:\s*(\d+)")
    type_re = re.compile(r"Question Type\s*:\s*(MCQ|SA)")
    opt_re = re.compile(r"(?m)^\s*(\d{9,10})\.\s*$")

    for page_idx, page in enumerate(doc):
        text = page.get_text()
        blocks = page.get_text("blocks")
        images = page.get_image_info(xrefs=True)

        page_info = {
            "pageIndex": page_idx,
            "pageNumber": page_idx + 1,
            "width": page.rect.width,
            "height": page.rect.height,
            "textBlockCount": len(blocks),
            "imageCount": len(images),
            "images": [
                {
                    "xref": img.get("xref"),
                    "bbox": [round(c, 2) for c in img.get("bbox", [])],
                    "width": img.get("width"),
                    "height": img.get("height"),
                }
                for img in images
            ],
        }
        profile["pages"].append(page_info)

        # Regex detections
        for m in sec_re.finditer(text):
            profile["candidateMatches"]["sectionHeaders"].append({
                "page": page_idx + 1,
                "subject": m.group(1),
                "section": m.group(2),
                "fullMatch": m.group(0).strip(),
            })

        for m in q_re.finditer(text):
            profile["candidateMatches"]["questionHeaders"].append({
                "page": page_idx + 1,
                "questionNumber": int(m.group(1)),
                "questionId": m.group(2),
            })

        for m in type_re.finditer(text):
            profile["candidateMatches"]["questionTypes"].append({
                "page": page_idx + 1,
                "type": m.group(1),
            })

        for m in opt_re.finditer(text):
            profile["candidateMatches"]["optionIds"].append({
                "page": page_idx + 1,
                "optionId": m.group(1),
            })

        if page_idx == 0:
            profile["sampleRawText"]["page1First40Lines"] = text.splitlines()[:40]
        elif page_idx == 1:
            profile["sampleRawText"]["page2First40Lines"] = text.splitlines()[:40]

    doc.close()

    q_count = len(profile["candidateMatches"]["questionHeaders"])
    sec_count = len(profile["candidateMatches"]["sectionHeaders"])
    opt_count = len(profile["candidateMatches"]["optionIds"])
    total_images = sum(p["imageCount"] for p in profile["pages"])
    profile["summary"] = (
        f"Dynamic PDF Profile for {pdf_path.name}: "
        f"{profile['pageCount']} pages, {total_images} embedded image entries, "
        f"{sec_count} detected section headers, {q_count} detected question headers, "
        f"and {opt_count} detected option IDs."
    )

    out_file = output_dir / "pdf_profile.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2)

    print("Inspection complete.")
    print(f"Total Pages: {profile['pageCount']}")
    print(f"Question Headers detected: {len(profile['candidateMatches']['questionHeaders'])}")
    print(f"Option IDs detected: {len(profile['candidateMatches']['optionIds'])}")
    print(f"Sections detected: {len(profile['candidateMatches']['sectionHeaders'])}")
    print(f"Saved profile to: {out_file}")
    return profile


def _build_parser(config: dict):
    parser_type = config.get("parser_type", "nta_cbt")
    if parser_type == "nta_cbt":
        return NtaCbtParser(config)
    if parser_type == "neet_scanned":
        return NeetScannedParser(config)
    if parser_type == "examgoal_neet":
        return ExamGoalNeetParser(config)
    if parser_type == "wbtet_scanned":
        return WbtetScannedParser(config)
    raise ValueError(f"Unsupported parser_type: {parser_type}")


def run_extract(
    pdf_path: Path,
    output_dir: Path,
    config_path: Path,
    random_answers: bool = False,
    seed: int = 2026,
) -> Path:
    """Run full extraction: parse, clip images, and export both Universal QnA and TestBench."""
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    config = load_config(str(config_path))
    output_dir.mkdir(parents=True, exist_ok=True)
    images_dir = output_dir / "images"

    print(f"Loading PDF: {pdf_path}")
    doc = pymupdf.open(str(pdf_path))

    print("Step 1: Parsing PDF structure...")
    parser = _build_parser(config)
    paper = parser.parse(doc)
    print(f"Parsed {len(paper.questions)} questions successfully.")

    render_dpi = int(config.get("scanner", {}).get("render_dpi", 240 if config.get("parser_type") == "examgoal_neet" else 300))
    clip_doc = paper.sanitized_doc if paper.sanitized_doc is not None else doc

    print(f"Step 2: Extracting, trimming and validating images (dpi={render_dpi})...")
    clipper = ImageClipper(clip_doc, images_dir, dpi=render_dpi)
    image_paths = clipper.extract_paper_images(paper)
    print(f"Extracted {len(image_paths['questions'])} question images and {len(image_paths['options'])} option images.")

    init_answers = (
        generate_random_answers(paper.total_questions, seed=seed)
        if random_answers
        else None
    )
    if init_answers:
        print(f"Initialized {len(init_answers)} random placeholder answers (seed={seed}).")

    print("Step 3: Exporting Universal Q&A Database JSON...")
    uni_exporter = UniversalQnAExporter(config)
    qna_json_path = output_dir / "qna_database.json"
    uni_exporter.export(
        paper,
        image_paths,
        qna_json_path,
        source_pdf_name=pdf_path.name,
        initial_answers=init_answers,
    )
    print(f"Saved Universal Q&A Database to: {qna_json_path}")

    print("Step 4: Exporting TestBench Paper JSON and ZIP...")
    tb_exporter = TestBenchExporter(config)
    tb_json_path = output_dir / "testbench_paper.json"
    tb_exporter.export_json(paper, image_paths, tb_json_path, initial_answers=init_answers)
    tb_zip_path = output_dir / "testbench_paper.zip"
    tb_exporter.export_zip(paper, image_paths, images_dir, tb_zip_path, initial_answers=init_answers)
    print(f"Saved TestBench Paper JSON to: {tb_json_path}")
    print(f"Saved TestBench ZIP to: {tb_zip_path}")

    print("Step 5: Running strict validation checks...")
    errors = run_all_validation_checks(qna_json_path, config_path)
    if errors:
        print(f"Validation FAILED with {len(errors)} error(s):")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("Validation PASSED: All checks passed.")

    return qna_json_path


def run_apply_keys(
    year: int,
    key_pdf: Path | None,
    book_code: str,
    qna_json: Path,
    testbench_json: Path,
    exam: str = "neet",
    key_json: Path | None = None,
) -> None:
    """Parse official answer key PDF/JSON and update existing QnA and TestBench JSON datasets."""
    if exam == "wbtet":
        default_keys = {
            2022: Path(__file__).parent / "answer_keys_data" / "wbtet_2022_WBBPE_02B.json",
            2023: Path(__file__).parent / "answer_keys_data" / "wbtet_2023_A1_23.json",
        }
        src_json = key_json or default_keys.get(year)
        if not src_json or not src_json.exists():
            raise ValueError(f"Missing WBTET official key JSON for {year}: {src_json}")
        answers = parse_wbtet_answer_key(src_json, expected_count=150)
    elif year == 2023:
        assert key_pdf is not None
        answers = parse_2023_answer_key(key_pdf, book_code=book_code or "G6")
    elif year == 2024:
        assert key_pdf is not None
        answers = parse_2024_or_2025_answer_key(key_pdf, book_code=book_code or "S6", expected_count=200)
    elif year == 2025:
        assert key_pdf is not None
        answers = parse_2024_or_2025_answer_key(key_pdf, book_code=book_code or "45", expected_count=180)
    elif year == 2026:
        assert key_pdf is not None
        answers = parse_2026_pdf_answer_key(key_pdf, expected_count=180)
    else:
        raise ValueError(f"Unsupported year for apply-keys: {year}")

    count = apply_answers_to_datasets(
        answers,
        qna_json_path=qna_json,
        testbench_json_path=testbench_json,
    )
    print(f"Applied {len(answers)} answer keys ({exam} {year}, code={book_code}) -> updated {count} QnA entries.")


def main():
    parser = argparse.ArgumentParser(description="PDF-to-QnA Extraction Pipeline")
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # inspect
    inspect_parser = subparsers.add_parser("inspect", help="Inspect PDF and generate profile")
    inspect_parser.add_argument("--input", "-i", type=Path, required=True, help="Input PDF file path")
    inspect_parser.add_argument("--output", "-o", type=Path, default=Path("dist/qna/jee-main-2026-shift2"), help="Output directory")

    # extract
    extract_parser = subparsers.add_parser("extract", help="Extract questions, options and images")
    extract_parser.add_argument("--input", "-i", type=Path, required=True, help="Input PDF file path")
    extract_parser.add_argument("--output", "-o", type=Path, default=Path("dist/qna/jee-main-2026-shift2"), help="Output directory")
    extract_parser.add_argument("--config", "-c", type=Path, default=Path("tools/pdf_qna_pipeline/configs/jee_main.yaml"), help="Config YAML path")
    extract_parser.add_argument("--random-answers", action="store_true", help="Initialize answers randomly prior to loading official key")
    extract_parser.add_argument("--seed", type=int, default=2026, help="Random seed for placeholder answers")

    # apply-keys
    keys_parser = subparsers.add_parser("apply-keys", help="Apply official answer keys to extracted datasets")
    keys_parser.add_argument("--exam", type=str, default="neet", choices=["neet", "wbtet"])
    keys_parser.add_argument("--year", type=int, required=True, choices=[2022, 2023, 2024, 2025, 2026])
    keys_parser.add_argument("--key-pdf", type=Path, default=None, help="Answer key PDF path")
    keys_parser.add_argument("--key-json", type=Path, default=None, help="Verified official answer key JSON path (for WBTET)")
    keys_parser.add_argument("--book-code", type=str, default="", help="Test booklet code (G6, S6, 45, WBBPE/02B, A1-23)")
    keys_parser.add_argument("--qna-json", type=Path, default=None, help="Path to qna_database.json to update")
    keys_parser.add_argument("--testbench-json", type=Path, default=None, help="Path to testbench paper JSON to update")

    # validate
    validate_parser = subparsers.add_parser("validate", help="Validate extracted database")
    validate_parser.add_argument("--input", "-i", type=Path, required=True, help="Input qna_database.json path")
    validate_parser.add_argument("--config", "-c", type=Path, default=Path("tools/pdf_qna_pipeline/configs/jee_main.yaml"), help="Config YAML path")

    args = parser.parse_args()

    if args.subcommand == "inspect":
        run_inspect(args.input, args.output)
    elif args.subcommand == "extract":
        run_extract(
            args.input,
            args.output,
            args.config,
            random_answers=args.random_answers,
            seed=args.seed,
        )
    elif args.subcommand == "apply-keys":
        run_apply_keys(
            args.year,
            args.key_pdf,
            args.book_code,
            args.qna_json,
            args.testbench_json,
            exam=args.exam,
            key_json=args.key_json,
        )
    elif args.subcommand == "validate":
        errs = run_all_validation_checks(args.input, args.config)
        if errs:
            print(f"Validation FAILED with {len(errs)} error(s):")
            for e in errs:
                print(f"  - {e}")
            sys.exit(1)
        else:
            print("Validation PASSED: All 8 checks passed.")
            sys.exit(0)


if __name__ == "__main__":
    main()
