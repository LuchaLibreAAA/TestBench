"""Derive TestBench paper JSON from the canonical Universal Q&A rows."""

import json
from functools import lru_cache
from typing import Any


@lru_cache(maxsize=64)
def _cached(paper_id: str, content_hash: str, metadata_json: str, rows_json: str) -> dict[str, Any]:
    metadata = json.loads(metadata_json)
    sections, questions = json.loads(rows_json)
    by_section: dict[str, list[dict[str, Any]]] = {section["section_id"]: [] for section in sections}
    for question in questions:
        by_section.setdefault(question["section_id"], []).append(question)
    exam = str(metadata.get("examName", "Exam")).lower().replace(" ", "-")
    tags = [exam, str(metadata.get("year", "")), str(metadata.get("session", "")).lower().replace(" ", "-"), str(metadata.get("shift", "")).lower().replace(" ", "-")]
    result_sections = []
    for section in sections:
        items = []
        for q in by_section.get(section["section_id"], []):
            content, options, answer = map(json.loads, (q["content_json"], q["options_json"], q["answer_json"]))
            images = [f"/api/v1/assets/{paper_id}/{name}" for name in content.get("imagePaths", [])]
            is_single = q["type"] == "single_choice"
            item: dict[str, Any] = {"id": f"q-{q['question_id']}", "type": "single" if is_single else "numerical",
                "topic": q["subject"], "text": {"en": content.get("text", "")}, "images": images}
            if is_single:
                item["options"] = [{"id": opt.get("label", ""), "text": {"en": opt.get("text", "")},
                                    "image": f"/api/v1/assets/{paper_id}/{opt['imagePaths'][0]}" if opt.get("imagePaths") else ""} for opt in options]
                item["answer"] = [next((o.get("label", "") for o in options if o.get("optionId") == answer.get("correctOptionId")), "a")]
            else:
                item["answer"] = answer.get("correctNumericValue", 0)
            items.append(item)
        marking = json.loads(section["marking_json"])
        result_sections.append({"id": section["section_id"], "name": {"en": section["section_name"]}, "marking": marking, "questions": items})
    title = f"{metadata.get('examName', 'Exam')} {metadata.get('year', '')} {metadata.get('session', '')} {metadata.get('shift', '')}".strip()
    return {"schemaVersion": 1, "id": paper_id, "title": title, "description": title,
            "exam": exam, "durationMin": metadata.get("durationMinutes", 180), "languages": ["en"],
            "navigation": "free", "instructions": {"en": title},
            "meta": {"author": metadata.get("examName", ""), "createdAt": metadata.get("date", ""), "tags": tags},
            "sections": result_sections}


def export_paper(paper_id: str, paper: Any, sections: list[Any], questions: list[Any]) -> dict[str, Any]:
    """Export with a small in-memory cache keyed by content hash."""
    meta = paper["exam_metadata_json"]
    section_rows = [{key: section[key] for key in ("section_id", "section_name", "marking_json")} for section in sections]
    question_rows = [{key: question[key] for key in ("section_id", "question_id", "subject", "type", "content_json", "options_json", "answer_json")} for question in questions]
    return _cached(paper_id, paper["content_hash"], meta, json.dumps([section_rows, question_rows], sort_keys=True))
