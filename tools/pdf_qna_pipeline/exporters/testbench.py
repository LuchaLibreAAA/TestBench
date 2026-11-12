"""Exporter for TestBench compatible PaperSchema JSON and ZIP packages."""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional
import zipfile

from tools.pdf_qna_pipeline.parsers.base import ParsedPaper


class TestBenchExporter:
    """Exports parsed paper to TestBench PaperSchema JSON and portable ZIP package."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    def build_paper_dict(
        self,
        paper: ParsedPaper,
        image_paths: Dict[str, Any],
        initial_answers: Optional[Dict[int, str]] = None,
    ) -> Dict[str, Any]:
        """Build TestBench schema-compliant dictionary."""
        paper_id = self.config.get("paper_id", "jee-main-2026-apr-s2")
        marking_cfg = self.config.get("marking", {})

        # Group questions by section
        questions_by_sec: Dict[str, List[Any]] = {}
        for q in paper.questions:
            questions_by_sec.setdefault(q.section_id, []).append(q)

        sections_list: List[Dict[str, Any]] = []
        for sec in self.config.get("sections", []):
            sec_id = sec["id"]
            sec_type = sec["type"]
            m_rules = marking_cfg.get(sec_type, {"correct": 4, "wrong": -1, "unattempted": 0})

            section_questions: List[Dict[str, Any]] = []
            for q in questions_by_sec.get(sec_id, []):
                q_imgs = image_paths.get("questions", {}).get(q.question_id, [])
                clean_q_imgs = [Path(p).name for p in q_imgs]
                q_text = getattr(q, "text", "")

                if q.question_type == "single_choice":
                    tb_options = []
                    for opt in q.options:
                        opt_imgs = image_paths.get("options", {}).get(opt.option_id, [])
                        opt_entry: Dict[str, Any] = {
                            "id": opt.label,
                            "text": {"en": getattr(opt, "text", "")},
                        }
                        if opt_imgs:
                            opt_entry["image"] = Path(opt_imgs[0]).name
                        tb_options.append(opt_entry)

                    init_ans = initial_answers.get(q.question_number, "a") if initial_answers else "a"
                    q_entry = {
                        "id": f"q-{q.question_id}",
                        "type": "single",
                        "topic": q.subject,
                        "text": {"en": q_text},
                        "images": clean_q_imgs,
                        "options": tb_options,
                        "answer": [init_ans],
                    }
                    loc_indices = (
                        paper.raw_metadata.get("localized_image_indices", {}).get(q.question_id)
                    )
                    if loc_indices:
                        localized_imgs = {
                            lang: [clean_q_imgs[i] for i in idxs if i < len(clean_q_imgs)]
                            for lang, idxs in loc_indices.items()
                        }
                        if localized_imgs:
                            q_entry["localizedImages"] = localized_imgs
                    section_questions.append(q_entry)
                else:  # numeric
                    section_questions.append({
                        "id": f"q-{q.question_id}",
                        "type": "numerical",
                        "topic": q.subject,
                        "text": {"en": q_text},
                        "images": clean_q_imgs,
                        "answer": 0,
                    })

            sec_dict: Dict[str, Any] = {
                "id": sec_id,
                "name": {"en": sec["name"]},
                "marking": {
                    "correct": m_rules.get("correct", 4),
                    "wrong": m_rules.get("wrong", -1),
                    "unattempted": m_rules.get("unattempted", 0),
                },
                "questions": section_questions,
            }
            if sec.get("attempt_limit"):
                sec_dict["attemptLimit"] = int(sec["attempt_limit"])
            sections_list.append(sec_dict)

        return {
            "schemaVersion": 1,
            "id": paper_id,
            "title": self.config.get("title", "JEE Main 2026 — 2nd April Shift 2"),
            "description": self.config.get(
                "description",
                "Official NTA JEE Main 2026 April Session (Shift 2) paper with cropped questions and options.",
            ),
            "exam": self.config.get("exam_slug", "jee-main"),
            "durationMin": self.config.get("duration_minutes", 180),
            "languages": self.config.get("languages", ["en"]),
            "navigation": "free",
            "instructions": {
                "en": self.config.get(
                    "instructions",
                    "Official NTA JEE Main Question Paper. 75 Questions (25 Mathematics, 25 Physics, 25 Chemistry).",
                )
            },
            "meta": {
                "author": self.config.get("author", "NTA (National Testing Agency)"),
                "createdAt": self.config.get("created_at", "2026-04-02T12:00:00Z"),
                "tags": self.config.get("tags", ["jee-main", "2026", "april", "shift-2", "official"]),
            },
            "sections": sections_list,
        }

    def export_json(
        self,
        paper: ParsedPaper,
        image_paths: Dict[str, Any],
        output_path: Path,
        initial_answers: Optional[Dict[int, str]] = None,
    ) -> Path:
        """Export TestBench paper JSON."""
        data = self.build_paper_dict(paper, image_paths, initial_answers=initial_answers)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return output_path

    def export_zip(
        self,
        paper: ParsedPaper,
        image_paths: Dict[str, Any],
        images_dir: Path,
        output_zip: Path,
        initial_answers: Optional[Dict[int, str]] = None,
    ) -> Path:
        """Export ZIP package containing paper.json and all referenced images."""
        paper_data = self.build_paper_dict(paper, image_paths, initial_answers=initial_answers)
        output_zip.parent.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            # Write paper.json
            zf.writestr("paper.json", json.dumps(paper_data, indent=2))

            # Write all images
            for img_file in images_dir.glob("*.png"):
                zf.write(img_file, arcname=f"images/{img_file.name}")

        return output_zip
