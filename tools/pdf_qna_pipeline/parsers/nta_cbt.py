"""Parser for National Testing Agency (NTA) Computer Based Test (CBT) PDFs."""

import re
from typing import Dict, Any, List, Optional, Tuple
import pymupdf

from tools.pdf_qna_pipeline.parsers.base import (
    BaseParser,
    PageRegion,
    ParsedOption,
    ParsedQuestion,
    ParsedPaper,
)


class NtaCbtParser(BaseParser):
    """Parses NTA CBT exam PDFs using config-driven rules."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.q_header_re = re.compile(config["regex"]["question_header"])
        self.opt_re = re.compile(config["regex"]["option_id"])
        self.sections_config = config["sections"]

    def _resolve_section(self, q_num: int) -> Tuple[str, str, str]:
        """Resolve section ID, section name, and subject for question number."""
        for sec in self.sections_config:
            q_start, q_end = sec["q_range"]
            if q_start <= q_num <= q_end:
                return sec["id"], sec["subject"], sec["type"]
        raise ValueError(f"Question number {q_num} does not fall into any configured section")

    def _find_question_headers(self, doc: pymupdf.Document) -> List[Dict[str, Any]]:
        """Walk doc pages and extract all question headers with bounding boxes."""
        headers = []
        for p_idx in range(len(doc)):
            page = doc[p_idx]
            for b in page.get_text("blocks"):
                m = self.q_header_re.search(b[4])
                if m:
                    headers.append({
                        "page": p_idx,
                        "q_num": int(m.group(1)),
                        "q_id": m.group(2),
                        "header_bbox": (b[0], b[1], b[2], b[3]),
                    })
        headers.sort(key=lambda x: x["q_num"])
        return headers

    def _collect_candidate_images(
        self,
        doc: pymupdf.Document,
        pages: List[int],
        start_page: int,
        start_y: float,
        end_page: Optional[int],
        end_y: Optional[float],
    ) -> List[Dict[str, Any]]:
        """Collect all image bboxes within question boundaries across pages."""
        images = []
        for p in pages:
            for img in doc[p].get_image_info(xrefs=True):
                bbox = img.get("bbox", [])
                if not bbox:
                    continue
                # Boundary filtering
                if p == start_page and bbox[3] <= start_y:
                    continue
                if end_page is not None and p == end_page and bbox[1] >= end_y:
                    continue
                # Ignore global footer watermark
                if bbox[1] > 815:
                    continue
                images.append({
                    "page": p,
                    "xref": img.get("xref", 0),
                    "bbox": (bbox[0], bbox[1], bbox[2], bbox[3]),
                    "width": img.get("width"),
                    "height": img.get("height"),
                })
        return images

    def _find_options_for_question(
        self,
        doc: pymupdf.Document,
        pages: List[int],
        start_page: int,
        start_y: float,
        end_page: Optional[int],
        end_y: Optional[float],
    ) -> Tuple[List[Dict[str, Any]], Optional[Tuple[int, float]]]:
        """Find option lines and the 'Options :' marker position within question region."""
        opts = []
        marker_pos = None
        for p in pages:
            for b in doc[p].get_text("blocks"):
                if p == start_page and b[3] <= start_y:
                    continue
                if end_page is not None and p == end_page and b[1] >= end_y:
                    continue
                if "Options :" in b[4] and marker_pos is None:
                    marker_pos = (p, b[1])
                for m in self.opt_re.finditer(b[4]):
                    opts.append({
                        "opt_id": m.group(1),
                        "page": p,
                        "bbox": (b[0], b[1], b[2], b[3]),
                    })
        return opts, marker_pos

    def _match_option_image(
        self,
        opt: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        page_doc: pymupdf.Page,
    ) -> PageRegion:
        """Match an option to its candidate image, or fallback to clip bbox."""
        opt_p = opt["page"]
        opt_y0, opt_y1 = opt["bbox"][1], opt["bbox"][3]
        matched = None
        best_dist = float("inf")

        for img in candidates:
            if img["page"] == opt_p and img["bbox"][0] >= 75:
                img_y0, img_y1 = img["bbox"][1], img["bbox"][3]
                dist = min(
                    abs(img_y0 - opt_y0),
                    abs(img_y1 - opt_y1),
                    abs((img_y0 + img_y1) / 2.0 - (opt_y0 + opt_y1) / 2.0),
                )
                if dist < best_dist and dist < 80:
                    best_dist = dist
                    matched = img

        if matched:
            candidates.remove(matched)
            return PageRegion(page=matched["page"], bbox=matched["bbox"], xref=matched["xref"])

        # Fallback clip region: x from 90 to 560, centered on opt_y
        fallback_bbox = (90.0, max(0.0, opt_y0 - 15), 560.0, min(page_doc.rect.height, opt_y1 + 15))
        return PageRegion(page=opt_p, bbox=fallback_bbox, xref=0)

    def parse(self, doc: pymupdf.Document) -> ParsedPaper:
        """Parse NTA CBT document into ParsedPaper."""
        headers = self._find_question_headers(doc)
        total_q = len(headers)
        if total_q != self.config.get("total_questions", 75):
            raise ValueError(f"Expected {self.config.get('total_questions', 75)} questions, found {total_q}")

        parsed_questions: List[ParsedQuestion] = []
        opt_labels = ["a", "b", "c", "d"]

        for i, q in enumerate(headers):
            q_num = q["q_num"]
            q_id = q["q_id"]
            sec_id, subject, q_type = self._resolve_section(q_num)
            next_q = headers[i + 1] if i + 1 < total_q else None

            # Calculate pages spanned by question
            pages = [q["page"]]
            if next_q and next_q["page"] > q["page"]:
                pages.extend(range(q["page"] + 1, next_q["page"] + 1))
            elif not next_q and q["page"] + 1 < len(doc):
                pages.append(q["page"] + 1)

            end_page = next_q["page"] if next_q else None
            end_y = next_q["header_bbox"][1] if next_q else None

            # Collect raw candidates
            candidate_imgs = self._collect_candidate_images(
                doc, pages, q["page"], q["header_bbox"][1], end_page, end_y
            )

            # Detect options
            raw_opts, opt_marker = self._find_options_for_question(
                doc, pages, q["page"], q["header_bbox"][1], end_page, end_y
            )

            # Separate statement vs option images
            if opt_marker:
                stmt_imgs = [
                    img for img in candidate_imgs
                    if (img["page"] < opt_marker[0])
                    or (img["page"] == opt_marker[0] and img["bbox"][3] <= opt_marker[1] + 5)
                ]
                opt_imgs = [img for img in candidate_imgs if img not in stmt_imgs]
            else:
                stmt_imgs = candidate_imgs
                opt_imgs = []

            # Statement image regions
            statement_regions = [
                PageRegion(page=img["page"], bbox=img["bbox"], xref=img["xref"])
                for img in stmt_imgs
            ]

            # Parse options
            parsed_options: List[ParsedOption] = []
            if q_type == "single_choice":
                if len(raw_opts) != 4:
                    raise ValueError(f"Question {q_num} (ID {q_id}) expected 4 options, found {len(raw_opts)}")
                for o_idx, opt in enumerate(raw_opts):
                    opt_region = self._match_option_image(opt, opt_imgs, doc[opt["page"]])
                    parsed_options.append(
                        ParsedOption(
                            option_number=o_idx + 1,
                            option_id=opt["opt_id"],
                            label=opt_labels[o_idx],
                            page=opt["page"],
                            label_bbox=opt["bbox"],
                            image_region=opt_region,
                        )
                    )

            parsed_questions.append(
                ParsedQuestion(
                    question_number=q_num,
                    question_id=q_id,
                    question_type=q_type,
                    section_id=sec_id,
                    subject=subject,
                    source_pages=pages,
                    header_bbox=q["header_bbox"],
                    statement_images=statement_regions,
                    options=parsed_options,
                )
            )

        return ParsedPaper(
            exam_name=self.config.get("exam_name", "JEE Main"),
            total_questions=len(parsed_questions),
            questions=parsed_questions,
            raw_metadata=self.config,
        )
