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
        "summary": (
            "Fact Analysis for NTA CBT JEE Main 2026 PDF: "
            "1. Questions and options are embedded raster images (XObjects) accompanied by selectable text metadata. "
            "2. Questions cross page boundaries (e.g. Q21 crosses from Page 8 to 9, Q45 statement is on Page 17 while options are on Page 18, Q75 crosses Page 30 to 31). "
            "3. Section A consists of 60 single-choice MCQs (20 per subject) with 4 options each labeled by 9-digit option IDs (format: `\\d{9,10}\\.`). "
            "4. Section B consists of 15 Short Answer (numeric) questions (5 per subject) with Question Type 'SA' and zero options. "
            "5. Total questions: exactly 75 numbered 1 to 75 across 6 sections."
        ),
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


def run_extract(pdf_path: Path, output_dir: Path, config_path: Path) -> Path:
    """Run full extraction: parse, clip images, and export both Universal QnA and TestBench."""
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    config = load_config(config_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    images_dir = output_dir / "images"

    print(f"Loading PDF: {pdf_path}")
    doc = pymupdf.open(str(pdf_path))

    print("Step 1: Parsing PDF structure...")
    parser = NtaCbtParser(config)
    paper = parser.parse(doc)
    print(f"Parsed {len(paper.questions)} questions successfully.")

    print("Step 2: Extracting, trimming and validating images...")
    clipper = ImageClipper(doc, images_dir)
    image_paths = clipper.extract_paper_images(paper)
    print(f"Extracted {len(image_paths['questions'])} question images and {len(image_paths['options'])} option images.")

    print("Step 3: Exporting Universal Q&A Database JSON...")
    uni_exporter = UniversalQnAExporter(config)
    qna_json_path = output_dir / "qna_database.json"
    uni_exporter.export(paper, image_paths, qna_json_path, source_pdf_name=pdf_path.name)
    print(f"Saved Universal Q&A Database to: {qna_json_path}")

    print("Step 4: Exporting TestBench Paper JSON and ZIP...")
    tb_exporter = TestBenchExporter(config)
    tb_json_path = output_dir / "testbench_paper.json"
    tb_exporter.export_json(paper, image_paths, tb_json_path)
    tb_zip_path = output_dir / "testbench_paper.zip"
    tb_exporter.export_zip(paper, image_paths, images_dir, tb_zip_path)
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
        print("Validation PASSED: All 8 checks passed.")

    return qna_json_path


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

    # validate
    validate_parser = subparsers.add_parser("validate", help="Validate extracted database")
    validate_parser.add_argument("--input", "-i", type=Path, required=True, help="Input qna_database.json path")
    validate_parser.add_argument("--config", "-c", type=Path, default=Path("tools/pdf_qna_pipeline/configs/jee_main.yaml"), help="Config YAML path")

    args = parser.parse_args()

    if args.subcommand == "inspect":
        run_inspect(args.input, args.output)
    elif args.subcommand == "extract":
        run_extract(args.input, args.output, args.config)
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
