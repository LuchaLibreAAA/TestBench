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

    # Check 2: Exactly 75 questions, numbered 1 to 75 without gaps
    q_nums = [q.questionNumber for q in questions]
    if len(questions) != 75:
        errors.append(f"Check 2 Failed: Expected 75 questions, found {len(questions)}")
    if q_nums != list(range(1, 76)):
        errors.append(f"Check 2 Failed: Question numbers are not 1..75 contiguous: {q_nums[:10]}...")

    # Check 3: Exactly 60 single_choice, 15 numeric
    mcqs = [q for q in questions if q.type == "single_choice"]
    numerics = [q for q in questions if q.type == "numeric"]
    if len(mcqs) != 60:
        errors.append(f"Check 3 Failed: Expected 60 single_choice MCQs, found {len(mcqs)}")
    if len(numerics) != 15:
        errors.append(f"Check 3 Failed: Expected 15 numeric questions, found {len(numerics)}")

    # Check 4: Each single_choice has exactly 4 options
    for q in mcqs:
        if len(q.options) != 4:
            errors.append(f"Check 4 Failed: Q{q.questionNumber} has {len(q.options)} options (expected 4)")
    for q in numerics:
        if len(q.options) != 0:
            errors.append(f"Check 4 Failed: Numeric Q{q.questionNumber} has {len(q.options)} options (expected 0)")

    # Check 5: All question IDs unique; all 240 option IDs unique
    q_ids = [q.questionId for q in questions]
    if len(q_ids) != len(set(q_ids)):
        errors.append("Check 5 Failed: Duplicate question IDs detected")

    opt_ids = [opt.optionId for q in mcqs for opt in q.options]
    if len(opt_ids) != 240:
        errors.append(f"Check 5 Failed: Expected 240 option IDs, found {len(opt_ids)}")
    if len(opt_ids) != len(set(opt_ids)):
        errors.append("Check 5 Failed: Duplicate option IDs detected")

    # Check 6: Every imagePath in JSON exists on disk, size > 500 bytes, dimension >= 20x20
    referenced_images: Set[Path] = set()
    for q in questions:
        all_paths = list(q.content.imagePaths)
        for opt in q.options:
            all_paths.extend(opt.imagePaths)

        for rel_p in all_paths:
            img_file = base_dir / rel_p
            referenced_images.add(img_file.resolve())
            if not img_file.exists():
                errors.append(f"Check 6 Failed: Referenced image not found on disk: {img_file}")
                continue
            if img_file.stat().st_size <= 500:
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
