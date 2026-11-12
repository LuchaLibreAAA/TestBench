"""Exporter for the Universal Q&A Database format."""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional

from tools.pdf_qna_pipeline.models import (
    QnADatabase,
    ExamMetadata,
    SectionMeta,
    MarkingScheme,
    QuestionItem,
    ContentBlock,
    OptionItem,
    AnswerBlock,
    ExplanationBlock,
    SourceMeta,
)
from tools.pdf_qna_pipeline.parsers.base import ParsedPaper


class UniversalQnAExporter:
    """Exports parsed paper and clipped images into universal Q&A database JSON."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    def build_database(
        self,
        paper: ParsedPaper,
        image_paths: Dict[str, Any],
        source_pdf_name: str = "",
        initial_answers: Optional[Dict[int, str]] = None,
    ) -> QnADatabase:
        """Construct universal QnADatabase Pydantic object."""
        # Exam metadata
        exam_meta = ExamMetadata(
            examName=self.config.get("exam_name", "JEE Main"),
            year=self.config.get("year", 2026),
            session=self.config.get("session", "April"),
            date=str(self.config.get("date", "2026-04-02")),
            shift=self.config.get("shift", "Shift 2"),
            paper=self.config.get("paper", "B.Tech"),
            totalMarks=self.config.get("total_marks", 300),
            durationMinutes=self.config.get("duration_minutes", 180),
            totalQuestions=paper.total_questions,
            sourcePdf=source_pdf_name or self.config.get("source_pdf", ""),
        )

        # Sections
        sections: List[SectionMeta] = []
        marking_cfg = self.config.get("marking", {})
        for sec in self.config.get("sections", []):
            q_type = sec["type"]
            m_rules = marking_cfg.get(q_type, {"correct": 4, "wrong": -1, "unattempted": 0})
            sections.append(
                SectionMeta(
                    sectionId=sec["id"],
                    sectionName=sec["name"],
                    subject=sec["subject"],
                    questionType=q_type,
                    markingScheme=MarkingScheme(
                        correct=m_rules.get("correct", 4),
                        wrong=m_rules.get("wrong", -1),
                        unattempted=m_rules.get("unattempted", 0),
                    ),
                )
            )

        # Questions
        questions: List[QuestionItem] = []
        for q in paper.questions:
            q_imgs = image_paths.get("questions", {}).get(q.question_id, [])

            # Options
            options: List[OptionItem] = []
            for opt in q.options:
                opt_imgs = image_paths.get("options", {}).get(opt.option_id, [])
                options.append(
                    OptionItem(
                        id=f"opt-{opt.option_id}",
                        optionNumber=opt.option_number,
                        optionId=opt.option_id,
                        label=opt.label,
                        text=getattr(opt, "text", ""),
                        imagePaths=opt_imgs,
                    )
                )

            extractor_type = "embedded" if any(r.xref > 0 for r in q.statement_images) else "clip"
            rand_label = initial_answers.get(q.question_number) if initial_answers else None
            matched_opt_id = None
            if rand_label:
                matched_opt = next((o for o in options if o.label == rand_label), None)
                matched_opt_id = matched_opt.id if matched_opt else rand_label

            questions.append(
                QuestionItem(
                    id=f"q-{q.question_id}",
                    questionNumber=q.question_number,
                    questionId=q.question_id,
                    sectionId=q.section_id,
                    subject=q.subject,
                    type=q.question_type,
                    content=ContentBlock(text=getattr(q, "text", ""), imagePaths=q_imgs),
                    options=options,
                    answer=AnswerBlock(
                        correctOptionId=matched_opt_id,
                        correctNumericValue=None,
                        isAnswerKeyAvailable=False,
                    ),
                    explanation=ExplanationBlock(text="", imagePaths=[]),
                    source=SourceMeta(
                        pages=[p + 1 for p in q.source_pages],
                        extractor=extractor_type,
                    ),
                )
            )

        return QnADatabase(
            schemaVersion="1.0",
            examMetadata=exam_meta,
            sections=sections,
            questions=questions,
        )

    def export(
        self,
        paper: ParsedPaper,
        image_paths: Dict[str, Any],
        output_file: Path,
        source_pdf_name: str = "",
        initial_answers: Optional[Dict[int, str]] = None,
    ) -> Path:
        """Export database to formatted JSON file."""
        database = self.build_database(
            paper,
            image_paths,
            source_pdf_name,
            initial_answers=initial_answers,
        )
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(database.model_dump(), f, indent=2)
        return output_file
