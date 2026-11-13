"""Derive TestBench paper JSON from the canonical Universal Q&A rows."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List


def _clean_img_name(path_str: str) -> str:
    return Path(path_str).name if path_str else ""


@lru_cache(maxsize=64)
def _cached(paper_id: str, content_hash: str, exam_code: str, metadata_json: str, rows_json: str) -> dict[str, Any]:
    metadata = json.loads(metadata_json)
    sections, questions = json.loads(rows_json)
    by_section: dict[str, list[dict[str, Any]]] = {section["section_id"]: [] for section in sections}
    for question in questions:
        by_section.setdefault(question["section_id"], []).append(question)

    exam = exam_code or str(metadata.get("examName", "exam")).lower().replace(" ", "-")
    tags = [
        exam,
        str(metadata.get("year", "")),
        str(metadata.get("session", "")).lower().replace(" ", "-"),
        str(metadata.get("shift", "")).lower().replace(" ", "-"),
    ]
    tags = [t for t in tags if t]

    result_sections = []
    for section in sections:
        items = []
        for q in by_section.get(section["section_id"], []):
            content = json.loads(q["content_json"])
            options = json.loads(q["options_json"])
            answer = json.loads(q["answer_json"])
            q_type = q["type"]

            images = [
                f"/api/v1/assets/{paper_id}/{_clean_img_name(name)}"
                for name in content.get("imagePaths", [])
                if name
            ]

            type_map = {
                "single_choice": "single",
                "numeric": "numerical",
                "multi_choice": "multi",
                "true_false": "tf",
            }
            cbt_type = type_map.get(q_type, "single")

            item: dict[str, Any] = {
                "id": f"q-{q['question_id']}",
                "type": cbt_type,
                "topic": q["subject"],
                "text": {"en": content.get("text", "")},
                "images": images,
            }

            # Optional content blocks
            if "content_blocks_json" in q and q["content_blocks_json"]:
                try:
                    blocks = json.loads(q["content_blocks_json"])
                    if blocks:
                        item["blocks"] = blocks
                except Exception:
                    pass

            if cbt_type in ("single", "multi"):
                item["options"] = [
                    {
                        "id": opt.get("label", ""),
                        "text": {"en": opt.get("text", "")},
                        "image": f"/api/v1/assets/{paper_id}/{_clean_img_name(opt['imagePaths'][0])}"
                        if opt.get("imagePaths")
                        else "",
                    }
                    for opt in options
                ]

                if cbt_type == "single":
                    chosen = next(
                        (o.get("label", "") for o in options if o.get("optionId") == answer.get("correctOptionId")),
                        None,
                    )
                    item["answer"] = [chosen or (options[0].get("label", "a") if options else "a")]
                else:
                    opt_ids = answer.get("correctOptionIds") or []
                    chosen = [o.get("label", "") for o in options if o.get("optionId") in opt_ids]
                    item["answer"] = chosen if chosen else ["a"]
            elif cbt_type == "numerical":
                val = answer.get("correctNumericValue")
                item["answer"] = val if val is not None else 0
            elif cbt_type == "tf":
                item["answer"] = "true" if answer.get("correctBooleanValue") else "false"

            items.append(item)

        marking = json.loads(section["marking_json"])
        sec_obj = {
            "id": section["section_id"],
            "name": {"en": section["section_name"]},
            "marking": marking,
            "questions": items,
        }
        if section.get("marking_strategy"):
            sec_obj["markingStrategy"] = section["marking_strategy"]
        if section.get("attempt_limit"):
            sec_obj["attemptLimit"] = section["attempt_limit"]

        result_sections.append(sec_obj)

    exam_name = metadata.get("examName", "Exam")
    year = metadata.get("year", "")
    session = metadata.get("session", "")
    shift = metadata.get("shift", "")
    date_str = metadata.get("date", "")

    if exam_name == "JEE Main":
        session_str = f" — {session} Session" if session else ""
        shift_parts = [p for p in [date_str, shift] if p]
        shift_str = f" ({', '.join(shift_parts)})" if shift_parts else ""
        title = f"JEE Main {year}{session_str}{shift_str}".strip()
        description = f"Official NTA JEE Main {session} {year} {shift} question paper.".strip()
    elif "NEET" in exam_name:
        title = f"NEET UG {year} — Official Question Paper"
        description = f"Complete National Eligibility cum Entrance Test (UG) {year}."
    elif "TET" in exam_name:
        title = f"WB Primary TET {year} — Official Question Paper"
        description = f"West Bengal Board of Primary Education (WBBPE) Teacher Eligibility Test {year}."
    else:
        title = f"{exam_name} {year}".strip()
        description = f"{exam_name} {year} question paper."

    return {
        "schemaVersion": 1,
        "id": paper_id,
        "title": title,
        "description": description,
        "exam": exam,
        "durationMin": metadata.get("durationMinutes", 180),
        "languages": ["en"],
        "navigation": "free",
        "instructions": {"en": title},
        "meta": {"author": metadata.get("examName", ""), "createdAt": metadata.get("date", ""), "tags": tags},
        "sections": result_sections,
    }


def export_paper(paper_id: str, paper: Any, sections: list[Any], questions: list[Any]) -> dict[str, Any]:
    """Export with in-memory caching keyed by content hash."""
    meta = paper["exam_metadata_json"]
    exam_code = paper["exam_code"] if "exam_code" in paper.keys() else ""
    section_rows = [
        {
            key: section[key]
            for key in ("section_id", "section_name", "marking_json", "marking_strategy", "attempt_limit")
            if key in section.keys()
        }
        for section in sections
    ]
    question_rows = [
        {
            key: question[key]
            for key in ("section_id", "question_id", "subject", "type", "content_json", "content_blocks_json", "options_json", "answer_json")
            if key in question.keys()
        }
        for question in questions
    ]
    return _cached(paper_id, paper["content_hash"], exam_code, meta, json.dumps([section_rows, question_rows], sort_keys=True))
