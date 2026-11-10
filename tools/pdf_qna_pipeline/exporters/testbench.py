"""Exporter for TestBench compatible PaperSchema JSON and ZIP packages."""

import json
from pathlib import Path
from typing import Dict, Any, List
import zipfile

from tools.pdf_qna_pipeline.parsers.base import ParsedPaper


class TestBenchExporter:
    """Exports parsed paper to TestBench PaperSchema JSON and portable ZIP package."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    def build_paper_dict(self, paper: ParsedPaper, image_paths: Dict[str, Any]) -> Dict[str, Any]:
        """Build TestBench schema-compliant dictionary."""
        paper_id = "jee-main-2026-apr-s2"
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
                # Normalize image filename for TestBench (just basename)
                clean_q_imgs = [Path(p).name for p in q_imgs]

                if q.question_type == "single_choice":
                    tb_options = []
                    for opt in q.options:
                        opt_imgs = image_paths.get("options", {}).get(opt.option_id, [])
                        clean_opt_img = Path(opt_imgs[0]).name if opt_imgs else ""
                        tb_options.append({
                            "id": opt.label,
                            "text": {"en": ""},
                            "image": clean_opt_img,
                        })

                    section_questions.append({
                        "id": f"q-{q.question_id}",
                        "type": "single",
                        "topic": q.subject,
                        "text": {"en": ""},
                        "images": clean_q_imgs,
                        "options": tb_options,
                        "answer": ["a"],  # Default placeholder until answer key is loaded
                    })
                else:  # numeric
                    section_questions.append({
                        "id": f"q-{q.question_id}",
                        "type": "numerical",
                        "topic": q.subject,
                        "text": {"en": ""},
                        "images": clean_q_imgs,
                        "answer": 0,  # Default placeholder until answer key is loaded
                    })

            sections_list.append({
                "id": sec_id,
                "name": {"en": sec["name"]},
                "marking": {
                    "correct": m_rules.get("correct", 4),
                    "wrong": m_rules.get("wrong", -1),
                    "unattempted": m_rules.get("unattempted", 0),
                },
                "questions": section_questions,
            })

        return {
            "schemaVersion": 1,
            "id": paper_id,
            "title": "JEE Main 2026 — 2nd April Shift 2",
            "description": "Official NTA JEE Main 2026 April Session (Shift 2) paper with cropped questions and options.",
            "exam": "jee-main",
            "durationMin": self.config.get("duration_minutes", 180),
            "languages": ["en"],
            "navigation": "free",
            "instructions": {
                "en": "Official NTA JEE Main Question Paper. 75 Questions (25 Mathematics, 25 Physics, 25 Chemistry)."
            },
            "meta": {
                "author": "NTA (National Testing Agency)",
                "createdAt": "2026-04-02T12:00:00Z",
                "tags": ["jee-main", "2026", "april", "shift-2", "official"],
            },
            "sections": sections_list,
        }

    def export_json(self, paper: ParsedPaper, image_paths: Dict[str, Any], output_path: Path) -> Path:
        """Export TestBench paper JSON."""
        data = self.build_paper_dict(paper, image_paths)
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
    ) -> Path:
        """Export ZIP package containing paper.json and all referenced images."""
        paper_data = self.build_paper_dict(paper, image_paths)
        output_zip.parent.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            # Write paper.json
            zf.writestr("paper.json", json.dumps(paper_data, indent=2))

            # Write all images
            for img_file in images_dir.glob("*.png"):
                zf.write(img_file, arcname=f"images/{img_file.name}")

        return output_zip
