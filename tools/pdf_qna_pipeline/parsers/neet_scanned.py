"""Parser for NTA scanned bilingual 2-column NEET UG PDFs (2023-2025)."""

from typing import Dict, Any, List, Tuple
import cv2
import numpy as np
import pymupdf

from tools.pdf_qna_pipeline.parsers.base import (
    BaseParser,
    PageRegion,
    ParsedOption,
    ParsedPaper,
    ParsedQuestion,
)


class NeetScannedParser(BaseParser):
    """Detects English-column question regions via left-gutter number segmentation."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.paper_id = config.get("paper_id", "neet-ug")
        self.scanner = config["scanner"]
        self.sections = config["sections"]

    def _section_for_question(self, q_num: int) -> Tuple[str, str]:
        for sec in self.sections:
            start_q, end_q = sec["q_range"]
            if start_q <= q_num <= end_q:
                return sec["id"], sec["subject"]
        raise ValueError(f"Question {q_num} does not fall within any configured section.")

    def _detect_page_question_ys(
        self,
        page: pymupdf.Page,
        det_dpi: int,
        gx0: int,
        gx1: int,
        y_min_frac: float,
        y_max_frac: float,
    ) -> List[float]:
        """Return PDF-point top y-coordinates of questions started on this page."""
        clip = pymupdf.Rect(0, 0, page.rect.width * 0.55, page.rect.height)
        pix = page.get_pixmap(clip=clip, dpi=det_dpi)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        gray = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_RGB2GRAY)
        dark = (gray < 175).astype(np.uint8)

        y_min_px = int(pix.height * y_min_frac)
        y_max_px = int(pix.height * y_max_frac)
        gutter = dark[y_min_px:y_max_px, gx0:gx1]

        row_has_ink = gutter.sum(axis=1) > 0
        pt_scale = 72.0 / float(det_dpi)
        y_hits_pt: List[float] = []

        in_blob = False
        b_start = 0
        for y_idx, val in enumerate(row_has_ink):
            if val and not in_blob:
                in_blob = True
                b_start = y_idx
            elif not val and in_blob:
                in_blob = False
                bh = y_idx - b_start
                sub = gutter[b_start:y_idx, :]
                cols = np.where(sub.sum(axis=0) > 0)[0]
                cw = int(cols[-1] - cols[0] + 1) if len(cols) else 0
                ink = int(sub.sum())
                if 7 <= bh <= 30 and cw >= 6 and ink >= 18:
                    gap_right_ink = int(dark[y_min_px + b_start : y_min_px + y_idx, gx1 : gx1 + 8].sum())
                    if cw >= 15 or gap_right_ink <= 2:
                        y_hits_pt.append((y_min_px + b_start) * pt_scale)

        return y_hits_pt

    def parse(self, doc: pymupdf.Document) -> ParsedPaper:
        """Parse scanned NEET question booklet into structured ParsedPaper."""
        start_p = int(self.scanner["start_page"]) - 1
        end_p = int(self.scanner["end_page"]) - 1
        det_dpi = int(self.scanner.get("detection_dpi", 150))
        gx0, gx1 = self.scanner["gutter_x_px"]
        bx0, bx1 = self.scanner["body_x_pt"]
        y_min_frac = float(self.scanner.get("y_min_frac", 0.042))
        y_max_frac = float(self.scanner.get("y_max_frac", 0.880))

        questions: List[ParsedQuestion] = []
        q_counter = 0

        for pno in range(start_p, end_p + 1):
            page = doc[pno]
            page_h = float(page.rect.height)
            y_min_pt = page_h * y_min_frac
            y_max_pt = page_h * y_max_frac

            ys = self._detect_page_question_ys(page, det_dpi, gx0, gx1, y_min_frac, y_max_frac)
            for idx, q_y0 in enumerate(ys):
                q_counter += 1
                sec_id, subject = self._section_for_question(q_counter)
                clip_y0 = max(y_min_pt, q_y0 - 3.0)
                clip_y1 = ys[idx + 1] - 5.0 if idx + 1 < len(ys) else y_max_pt
                if clip_y1 <= clip_y0 + 12.0:
                    raise ValueError(
                        f"Invalid clip height for Q{q_counter} on page {pno + 1}: "
                        f"y0={clip_y0:.1f}, y1={clip_y1:.1f}"
                    )

                qid = f"{self.paper_id}-q{q_counter:03d}"
                bbox = (float(bx0), clip_y0, float(bx1), clip_y1)
                opts = [
                    ParsedOption(
                        option_number=opt_idx,
                        option_id=f"{qid}-opt{opt_idx}",
                        label=chr(ord("a") + opt_idx - 1),
                        page=pno,
                        label_bbox=(0.0, 0.0, 0.0, 0.0),
                        image_region=None,
                        text=f"Option ({opt_idx})",
                    )
                    for opt_idx in range(1, 5)
                ]

                questions.append(
                    ParsedQuestion(
                        question_number=q_counter,
                        question_id=qid,
                        question_type="single_choice",
                        section_id=sec_id,
                        subject=subject,
                        source_pages=[pno],
                        header_bbox=(float(bx0), clip_y0, float(bx1), clip_y0 + 14.0),
                        statement_images=[PageRegion(page=pno, bbox=bbox, xref=0)],
                        options=opts,
                        text="",
                    )
                )

        expected = int(self.config.get("total_questions", 200))
        if len(questions) != expected:
            raise ValueError(
                f"Expected {expected} questions for {self.paper_id}, detected {len(questions)}."
            )

        return ParsedPaper(
            exam_name=self.config.get("exam_name", "NEET UG"),
            total_questions=len(questions),
            questions=questions,
            raw_metadata={"booklet_code": self.config.get("booklet_code", "")},
        )
