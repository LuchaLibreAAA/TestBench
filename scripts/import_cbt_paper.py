"""Reverse-map a TestBench CBT PaperSchema JSON to Universal Q&A and ingest it."""

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.services.ingest import ingest_data_and_images
from backend.app.settings import Settings, get_settings
from tools.pdf_qna_pipeline.models import (
    AnswerBlock,
    ContentBlock,
    ExamMetadata,
    ExplanationBlock,
    MarkingScheme,
    OptionItem,
    QnADatabase,
    QuestionItem,
    SectionMeta,
    SourceMeta,
)


def cbt_to_qna(paper_json: Dict[str, Any]) -> QnADatabase:
    """Convert CBT PaperSchema JSON into Universal Q&A Database model."""
    paper_id = paper_json["id"]
    exam_raw = paper_json.get("exam", "Exam")
    year = paper_json.get("year", 2024)

    # Derive exam metadata
    exam_name = "JEE Main" if "jee" in exam_raw else ("NEET UG" if "neet" in exam_raw else ("WB Primary TET" if "tet" in exam_raw else exam_raw))
    meta = ExamMetadata(
        examName=exam_name,
        year=year,
        paper=paper_json.get("title", ""),
        totalMarks=300,
        durationMinutes=paper_json.get("durationMin", 180),
        totalQuestions=sum(len(s.get("questions", [])) for s in paper_json.get("sections", [])),
    )

    sections = []
    questions = []
    global_q_num = 1

    for s_idx, sec in enumerate(paper_json.get("sections", [])):
        s_id = sec.get("id", f"sec-{s_idx+1}")
        s_name = sec.get("name", {}).get("en", s_id) if isinstance(sec.get("name"), dict) else str(sec.get("name", s_id))
        marking = sec.get("marking", {})
        scheme = MarkingScheme(
            correct=marking.get("correct", 4),
            wrong=marking.get("wrong", -1),
            unattempted=marking.get("unattempted", 0),
        )

        # Subject inference
        subj = "Physics"
        lower_name = s_name.lower()
        if "chem" in lower_name:
            subj = "Chemistry"
        elif "math" in lower_name:
            subj = "Mathematics"
        elif "bio" in lower_name or "bot" in lower_name or "zoo" in lower_name:
            subj = "Biology"
        elif "cdp" in lower_name or "child" in lower_name:
            subj = "CDP"
        elif "bengali" in lower_name or "lang" in lower_name:
            subj = "Language"
        elif "evs" in lower_name or "enviro" in lower_name:
            subj = "EVS"

        sections.append(
            SectionMeta(
                sectionId=s_id,
                sectionName=s_name,
                subject=subj,
                questionType="single_choice",
                markingScheme=scheme,
            )
        )

        for q in sec.get("questions", []):
            raw_id = str(q.get("id", f"q{global_q_num}"))
            clean_qid = raw_id.replace("q-", "").replace("q_", "")
            q_type = q.get("type", "single")
            type_mapped = "single_choice"
            if q_type in ("numerical", "numeric"):
                type_mapped = "numeric"
            elif q_type in ("multi", "multi_choice"):
                type_mapped = "multi_choice"
            elif q_type in ("tf", "true_false"):
                type_mapped = "true_false"

            # Content
            text_en = q.get("text", {}).get("en", "") if isinstance(q.get("text"), dict) else str(q.get("text", ""))
            raw_imgs = q.get("images", [])
            img_paths = [Path(img).name for img in raw_imgs if img]
            content = ContentBlock(text=text_en, imagePaths=img_paths)

            # Options
            options = []
            for opt_idx, opt in enumerate(q.get("options", [])):
                lbl = opt.get("id", chr(ord("a") + opt_idx))
                opt_text = opt.get("text", {}).get("en", "") if isinstance(opt.get("text"), dict) else str(opt.get("text", ""))
                opt_img = opt.get("image", "")
                opt_imgs = [Path(opt_img).name] if opt_img else []
                options.append(
                    OptionItem(
                        id=f"opt-{clean_qid}-{lbl}",
                        optionNumber=opt_idx + 1,
                        optionId=f"opt-{clean_qid}-{lbl}",
                        label=lbl,
                        text=opt_text,
                        imagePaths=opt_imgs,
                    )
                )

            # Answer
            raw_ans = q.get("answer")
            ans_block = AnswerBlock(isAnswerKeyAvailable=raw_ans is not None)
            if type_mapped == "single_choice":
                if isinstance(raw_ans, list) and raw_ans:
                    chosen_lbl = str(raw_ans[0])
                    matching_opt = next((o for o in options if o.label == chosen_lbl or o.id == chosen_lbl), None)
                    if matching_opt:
                        ans_block.correctOptionId = matching_opt.optionId
                    else:
                        ans_block.correctOptionId = f"opt-{clean_qid}-{chosen_lbl}"
                elif isinstance(raw_ans, str):
                    ans_block.correctOptionId = f"opt-{clean_qid}-{raw_ans}"
            elif type_mapped == "numeric":
                if isinstance(raw_ans, (int, float)):
                    ans_block.correctNumericValue = float(raw_ans)
            elif type_mapped == "multi_choice":
                if isinstance(raw_ans, list):
                    ans_block.correctOptionIds = [f"opt-{clean_qid}-{lbl}" for lbl in raw_ans]

            questions.append(
                QuestionItem(
                    id=f"q-{clean_qid}",
                    questionNumber=global_q_num,
                    questionId=clean_qid,
                    sectionId=s_id,
                    subject=subj,
                    type=type_mapped,
                    content=content,
                    options=options,
                    answer=ans_block,
                    explanation=ExplanationBlock(text=""),
                    source=SourceMeta(),
                )
            )
            global_q_num += 1

    return QnADatabase(
        schemaVersion="1.0",
        examMetadata=meta,
        sections=sections,
        questions=questions,
    )


def import_cbt_file(cbt_path: Path, settings: Settings | None = None) -> Any:
    """Import a CBT paper JSON into the database."""
    config = settings or get_settings()
    raw = json.loads(cbt_path.read_text(encoding="utf-8"))
    paper_id = raw["id"]
    qna = cbt_to_qna(raw)

    # Check companion assets
    images = {}
    assets_dir = cbt_path.parent.parent / "assets" / paper_id
    if assets_dir.is_dir():
        for f in assets_dir.iterdir():
            if f.is_file() and f.suffix.lower() in (".png", ".webp", ".jpg"):
                images[f.name] = f.read_bytes()

    return ingest_data_and_images(qna, paper_id, images, config)


if __name__ == "__main__":
    import sys
    settings = get_settings()
    for arg in sys.argv[1:]:
        p = Path(arg)
        if p.is_file():
            res = import_cbt_file(p, settings)
            print(f"Imported {p.name}: {res.status} (version {res.data_version})")
