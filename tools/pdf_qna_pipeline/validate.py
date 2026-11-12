"""Validation script running 8 hard checks on extracted Q&A dataset."""

import json
import sys
from pathlib import Path
from typing import Dict, Any, List, Set, Optional
from PIL import Image

# Ensure project root is in sys.path when running script directly
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from tools.pdf_qna_pipeline.models import QnADatabase
from tools.pdf_qna_pipeline.config import load_config


def run_all_validation_checks(json_path: Path, config_path: Optional[Path] = None) -> List[str]:
    """
    Execute 8 strict validation checks on qna_database.json and associated images.
    Returns a list of error messages (empty list means all passed).
    """
    errors: List[str] = []

    if not json_path.exists():
        return [f"File not found: {json_path}"]

    base_dir = json_path.parent
    images_dir = base_dir / "images"

    # Load raw JSON
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except Exception as e:
        return [f"Invalid JSON file: {e}"]

    # Check 1: Schema validation (Pydantic)
    try:
        db = QnADatabase.model_validate(raw_data)
    except Exception as e:
        errors.append(f"Check 1 Failed (Pydantic Schema Validation): {e}")
        return errors

    questions = db.questions

    cfg = load_config(str(config_path)) if config_path and config_path.exists() else {}
    expected_total = int(cfg.get("total_questions", 75))
    if cfg.get("sections"):
        expected_mcq = sum(
            s["q_range"][1] - s["q_range"][0] + 1
            for s in cfg["sections"]
            if s["type"] == "single_choice"
        )
        expected_num = sum(
            s["q_range"][1] - s["q_range"][0] + 1
            for s in cfg["sections"]
            if s["type"] == "numeric"
        )
    else:
        expected_mcq = 60
        expected_num = 15

    # Check 2: Contiguous questions 1..N without gaps
    q_nums = [q.questionNumber for q in questions]
    if len(questions) != expected_total:
        errors.append(f"Check 2 Failed: Expected {expected_total} questions, found {len(questions)}")
    if q_nums != list(range(1, expected_total + 1)):
        errors.append(f"Check 2 Failed: Question numbers are not 1..{expected_total} contiguous: {q_nums[:10]}...")

    # Check 3: Expected single_choice and numeric counts
    mcqs = [q for q in questions if q.type == "single_choice"]
    numerics = [q for q in questions if q.type == "numeric"]
    if len(mcqs) != expected_mcq:
        errors.append(f"Check 3 Failed: Expected {expected_mcq} single_choice MCQs, found {len(mcqs)}")
    if len(numerics) != expected_num:
        errors.append(f"Check 3 Failed: Expected {expected_num} numeric questions, found {len(numerics)}")

    # Check 4: Each single_choice has exactly 4 options
    for q in mcqs:
        if len(q.options) != 4:
            errors.append(f"Check 4 Failed: Q{q.questionNumber} has {len(q.options)} options (expected 4)")
    for q in numerics:
        if len(q.options) != 0:
            errors.append(f"Check 4 Failed: Numeric Q{q.questionNumber} has {len(q.options)} options (expected 0)")

    # Check 5: All question IDs unique; all option IDs unique
    q_ids = [q.questionId for q in questions]
    if len(q_ids) != len(set(q_ids)):
        errors.append("Check 5 Failed: Duplicate question IDs detected")

    expected_opts = expected_mcq * 4
    opt_ids = [opt.optionId for q in mcqs for opt in q.options]
    if len(opt_ids) != expected_opts:
        errors.append(f"Check 5 Failed: Expected {expected_opts} option IDs, found {len(opt_ids)}")
    if len(opt_ids) != len(set(opt_ids)):
        errors.append("Check 5 Failed: Duplicate option IDs detected")

    # Check 6: Every question/option has content (text or valid image) and every referenced image exists on disk
    referenced_images: Set[Path] = set()
    for q in questions:
        if not q.content.imagePaths and not q.content.text.strip():
            errors.append(f"Check 6 Failed: Q{q.questionNumber} has neither text nor images")
        all_paths = list(q.content.imagePaths)
        for opt in q.options:
            if not opt.imagePaths and not opt.text.strip():
                errors.append(f"Check 6 Failed: Q{q.questionNumber} opt {opt.label} has neither text nor image")
            all_paths.extend(opt.imagePaths)

        for rel_p in all_paths:
            img_file = base_dir / rel_p
            referenced_images.add(img_file.resolve())
            if not img_file.exists():
                errors.append(f"Check 6 Failed: Referenced image not found on disk: {img_file}")
                continue
            if img_file.stat().st_size <= 150:
                errors.append(f"Check 6 Failed: Image file too small ({img_file.stat().st_size} bytes): {img_file}")
            try:
                with Image.open(img_file) as img:
                    if img.width < 20 or img.height < 20:
                        errors.append(f"Check 6 Failed: Image dimensions too small ({img.width}x{img.height}): {img_file}")
            except Exception as e:
                errors.append(f"Check 6 Failed: Could not open image {img_file}: {e}")

    # Check 7: No orphaned images in images/ directory
    if images_dir.exists():
        disk_images = {p.resolve() for p in images_dir.glob("*.png")}
        orphaned = disk_images - referenced_images
        if orphaned:
            errors.append(f"Check 7 Failed: Found {len(orphaned)} orphaned images on disk: {[p.name for p in list(orphaned)[:5]]}")

    # Check 8: Section ranges match config
    if config_path and config_path.exists():
        cfg = load_config(config_path)
        for sec in cfg.get("sections", []):
            start_q, end_q = sec["q_range"]
            for q_num in range(start_q, end_q + 1):
                q = next((item for item in questions if item.questionNumber == q_num), None)
                if not q:
                    errors.append(f"Check 8 Failed: Q{q_num} missing from section {sec['id']}")
                elif q.sectionId != sec["id"]:
                    errors.append(f"Check 8 Failed: Q{q_num} has sectionId '{q.sectionId}', expected '{sec['id']}'")
                elif q.type != sec["type"]:
                    errors.append(f"Check 8 Failed: Q{q_num} has type '{q.type}', expected '{sec['type']}'")

    return errors


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate.py <path_to_qna_database.json> [path_to_config.yaml]")
        sys.exit(1)

    json_file = Path(sys.argv[1])
    config_file = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("tools/pdf_qna_pipeline/configs/jee_main.yaml")

    errors = run_all_validation_checks(json_file, config_file)

    if errors:
        print(f"Validation FAILED with {len(errors)} error(s):")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("Validation PASSED: All 8 strict checks passed successfully!")
        sys.exit(0)


if __name__ == "__main__":
    main()
