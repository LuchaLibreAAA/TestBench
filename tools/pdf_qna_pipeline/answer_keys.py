"""Answer key parsers and updaters for NEET UG (2023-2026)."""

import json
import random
import re
from pathlib import Path
from typing import Dict, List, Optional
import pymupdf


OPTION_NUM_TO_LABEL = {"1": "a", "2": "b", "3": "c", "4": "d"}
LETTER_TO_LABEL = {"A": "a", "B": "b", "C": "c", "D": "d"}


def generate_random_answers(total_questions: int, seed: int = 2026) -> Dict[int, str]:
    """Generate deterministic random initial option labels ('a'..'d') for Phase 1."""
    rng = random.Random(seed)
    choices = ["a", "b", "c", "d"]
    return {q_num: rng.choice(choices) for q_num in range(1, total_questions + 1)}


def _normalize_nta_response(raw_res: str) -> List[str]:
    """Convert official NTA key code ('1'..'4', '1,2', 'B', 'E', '5') into option labels."""
    token = raw_res.strip().upper()
    if token in OPTION_NUM_TO_LABEL:
        return [OPTION_NUM_TO_LABEL[token]]
    if token == "B":  # NTA 2023 legend: B = both 1 & 3
        return ["a", "c"]
    if token == "E":  # NTA 2023 legend: E = both 2 & 4
        return ["b", "d"]
    if token in ("5", "DROP", "BONUS"):  # Dropped / bonus question: mark valid options
        return ["a", "b", "c", "d"]
    if "," in token:
        labels = [OPTION_NUM_TO_LABEL[p.strip()] for p in token.split(",") if p.strip() in OPTION_NUM_TO_LABEL]
        if labels:
            return labels
    raise ValueError(f"Unrecognized NTA answer key response token: {raw_res!r}")


def parse_2023_answer_key(pdf_path: Path, book_code: str = "G6", expected_count: int = 200) -> Dict[int, List[str]]:
    """Extract NEET 2023 official answer key for target book code."""
    doc = pymupdf.open(str(pdf_path))
    target_text = ""
    for page in doc:
        txt = page.get_text("text")
        if re.search(rf"BOOK\s+CODE\s*:\s*{re.escape(book_code)}\b", txt, re.I):
            target_text = txt
            break
    if not target_text:
        raise ValueError(f"Book Code '{book_code}' not found in {pdf_path}")

    pairs = re.findall(r"\b(\d{1,3})\s*\|\s*([0-9,]+|[A-Za-z]+)", target_text)
    answers: Dict[int, List[str]] = {}
    for q_str, res in pairs:
        q_num = int(q_str)
        if 1 <= q_num <= expected_count:
            answers[q_num] = _normalize_nta_response(res)

    if len(answers) != expected_count:
        raise ValueError(f"Expected {expected_count} answers for 2023 Code {book_code}, got {len(answers)}")
    return answers


def _parse_nta_column_key(text: str, expected_count: int) -> Dict[int, List[str]]:
    """Parse 2024/2025 NTA Answer Key format (alternating Q.No / Answer lines)."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    answers: Dict[int, List[str]] = {}
    idx = 0
    while idx < len(lines) - 1:
        cur = lines[idx]
        nxt = lines[idx + 1]
        if re.fullmatch(r"\d{1,3}", cur) and 1 <= int(cur) <= expected_count:
            if re.fullmatch(r"[1-5]|(?:\d,)+\d|DROP|BONUS|[A-Z]", nxt, re.I):
                answers[int(cur)] = _normalize_nta_response(nxt)
                idx += 2
                continue
        idx += 1
    return answers


def parse_2024_or_2025_answer_key(pdf_path: Path, book_code: str, expected_count: int) -> Dict[int, List[str]]:
    """Extract NEET 2024/2025 NTA official answer key for target book code."""
    doc = pymupdf.open(str(pdf_path))
    for page in doc:
        txt = page.get_text("text")
        if re.search(rf"Test\s+Booklet\s+Code\s*:\s*{re.escape(book_code)}\b", txt, re.I):
            answers = _parse_nta_column_key(txt, expected_count)
            if len(answers) != expected_count:
                raise ValueError(
                    f"Expected {expected_count} answers for Code {book_code} in {pdf_path.name}, got {len(answers)}"
                )
            return answers
    raise ValueError(f"Test Booklet Code '{book_code}' not found in {pdf_path}")


def parse_2026_pdf_answer_key(pdf_path: Path, expected_count: int = 180) -> Dict[int, List[str]]:
    """Extract NEET 2026 answer key from trailing answer-key pages."""
    doc = pymupdf.open(str(pdf_path))
    combined = ""
    for page in doc:
        txt = page.get_text("text")
        if "Answer Key" in txt or page.number >= len(doc) - 3:
            combined += "\n" + txt

    pairs = re.findall(r"\b(\d{1,3})\.\s*([A-D](?:\s*,\s*[A-D])*)", combined, re.I)
    answers: Dict[int, List[str]] = {}
    for q_str, ans_str in pairs:
        q_num = int(q_str)
        if 1 <= q_num <= expected_count:
            labels = [LETTER_TO_LABEL[c.strip().upper()] for c in ans_str.split(",") if c.strip().upper() in LETTER_TO_LABEL]
            if labels:
                answers[q_num] = labels

    if len(answers) != expected_count:
        raise ValueError(f"Expected {expected_count} answers in {pdf_path.name}, got {len(answers)}")
    return answers


def apply_answers_to_datasets(
    answers: Dict[int, List[str]],
    qna_json_path: Optional[Path] = None,
    testbench_json_path: Optional[Path] = None,
) -> int:
    """Apply parsed answers to existing Universal QnA JSON and/or TestBench Paper JSON."""
    updated = 0

    if qna_json_path and qna_json_path.exists():
        with open(qna_json_path, "r", encoding="utf-8") as f:
            qna_data = json.load(f)
        for q in qna_data.get("questions", []):
            q_num = int(q["questionNumber"])
            ans_labels = answers.get(q_num)
            if not ans_labels:
                raise KeyError(f"Missing answer key for Q{q_num} in {qna_json_path}")
            # Primary correct option ID in QnA schema
            primary_label = ans_labels[0]
            matched_opt = next((o for o in q.get("options", []) if o["label"] == primary_label), None)
            if not matched_opt:
                raise ValueError(f"Option label '{primary_label}' not found for Q{q_num}")
            q["answer"]["correctOptionId"] = matched_opt["id"]
            q["answer"]["isAnswerKeyAvailable"] = True
            updated += 1
        with open(qna_json_path, "w", encoding="utf-8") as f:
            json.dump(qna_data, f, indent=2)

    if testbench_json_path and testbench_json_path.exists():
        with open(testbench_json_path, "r", encoding="utf-8") as f:
            tb_data = json.load(f)
        q_counter = 0
        for sec in tb_data.get("sections", []):
            for q in sec.get("questions", []):
                # Extract question number from trailing digits (e.g. neet-ug-2023-q001 -> 1)
                m = re.search(r"(\d+)$", q["id"])
                q_num = int(m.group(1)) if m else q_counter + 1
                q_counter += 1
                ans_labels = answers.get(q_num)
                if not ans_labels:
                    raise KeyError(f"Missing answer key for Q{q_num} in {testbench_json_path}")
                q["answer"] = ans_labels
        with open(testbench_json_path, "w", encoding="utf-8") as f:
            json.dump(tb_data, f, indent=2)

    return updated
