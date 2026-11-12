"""Parser and sanitizer for NEET 2026 PDF removing all third-party branding."""

import io
import re
from typing import Any, Dict, List, Tuple

import numpy as np
import pymupdf
from PIL import Image

from tools.pdf_qna_pipeline.parsers.base import (
    BaseParser,
    PageRegion,
    ParsedOption,
    ParsedPaper,
    ParsedQuestion,
)

PATTERN_DRAW_RE = re.compile(
    rb"/Pattern\s+CS\s*/Pattern\s+cs\s*/P\d+\s+SCN\s*/P\d+\s+scn"
    rb"(?:\s+/G\d+\s+gs)?\s+[\d.\-]+\s+[\d.\-]+\s+[\d.\-]+\s+[\d.\-]+\s+re\s+f\*?",
    re.S,
)
FORBIDDEN_BRAND_RE = re.compile(r"examgoal|examside|open\s+solution", re.I)


class ExamGoalNeetParser(BaseParser):
    """Strips watermarks/QR/footers in-memory and parses NEET 2026 questions cleanly."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.paper_id = config.get("paper_id", "neet-ug-2026")
        self.eg_cfg = config["examgoal"]
        self.sections = config["sections"]

    def _section_for_question(self, q_num: int) -> Tuple[str, str]:
        for sec in self.sections:
            start_q, end_q = sec["q_range"]
            if start_q <= q_num <= end_q:
                return sec["id"], sec["subject"]
        raise ValueError(f"Question {q_num} outside configured section ranges.")

    def _sanitize_document(self, src_doc: pymupdf.Document) -> pymupdf.Document:
        """Return an in-memory PDF clone with watermarks, QR codes, and diagram smasks cleaned."""
        clean_doc = pymupdf.open(stream=src_doc.tobytes(), filetype="pdf")
        start_p = int(self.eg_cfg["start_page"]) - 1
        end_p = int(self.eg_cfg["end_page"]) - 1
        qr_xref = int(self.eg_cfg.get("qr_xref", 9))
        smask_thresh = float(self.eg_cfg.get("smask_threshold", 90.0))

        # 1. Collect all diagram xrefs BEFORE modifying images (replace_image allocates new xrefs)
        diag_xrefs = set()
        for pno in range(start_p, end_p + 1):
            for info in clean_doc[pno].get_image_info(xrefs=True):
                xr = info["xref"]
                if xr not in (0, qr_xref):
                    diag_xrefs.add(xr)

        # 2. Replace QR code image xref with blank white PNG
        white_buf = io.BytesIO()
        Image.new("RGB", (4, 4), (255, 255, 255)).save(white_buf, format="PNG")
        for pno in range(start_p, end_p + 1):
            if qr_xref in [img[0] for img in clean_doc[pno].get_images()]:
                clean_doc[pno].replace_image(qr_xref, stream=white_buf.getvalue())
                break

        # 3. Clean all diagram smask XObjects onto solid white
        for xr in sorted(diag_xrefs):
            info = clean_doc.extract_image(xr)
            sm = info.get("smask", 0)
            if not sm:
                raise RuntimeError(
                    f"Unexpected non-smask diagram xref={xr}; cannot guarantee watermark removal."
                )
            rgb = np.array(Image.open(io.BytesIO(info["image"])).convert("RGB"), dtype=np.float32)
            mask = np.array(
                Image.open(io.BytesIO(clean_doc.extract_image(sm)["image"])).convert("L"),
                dtype=np.float32,
            )
            alpha = np.clip((mask - smask_thresh) / (255.0 - smask_thresh), 0.0, 1.0)[..., None]
            composited = np.clip(rgb * alpha + 255.0 * (1.0 - alpha), 0, 255).astype(np.uint8)
            out_buf = io.BytesIO()
            Image.fromarray(composited).save(out_buf, format="PNG")
            for pno in range(start_p, end_p + 1):
                if xr in [img[0] for img in clean_doc[pno].get_images()]:
                    clean_doc[pno].replace_image(xr, stream=out_buf.getvalue())
                    break

        # 3. Strip tiled /Pattern watermark draws across all question pages
        for pno in range(start_p, end_p + 1):
            page = clean_doc[pno]
            for cx in page.get_contents():
                raw = clean_doc.xref_stream(cx)
                cleaned, cnt = PATTERN_DRAW_RE.subn(b"", raw)
                if cnt:
                    clean_doc.update_stream(cx, cleaned)

        return clean_doc

    def _compute_option_regions(
        self,
        pno: int,
        opts: List[Tuple[str, float, float, float, float]],
        stem_y1: float,
        q_bottom_y: float,
        col_right: float,
    ) -> List[ParsedOption]:
        """Partition (A)-(D) markers into non-overlapping bounding boxes excluding '(A)' prefix."""
        # Group into rows sharing close y0 (within 8pt)
        rows: List[List[Tuple[str, float, float, float, float]]] = []
        for item in sorted(opts, key=lambda o: (o[2], o[1])):
            if not rows or abs(item[2] - rows[-1][0][2]) > 8.0:
                rows.append([item])
            else:
                rows[-1].append(item)

        for r in rows:
            r.sort(key=lambda o: o[1])

        by_label: Dict[str, Tuple[Tuple[float, float, float, float], Tuple[float, float, float, float]]] = {}
        for r_idx, row in enumerate(rows):
            row_top = max(stem_y1 + 0.5, min(o[2] for o in row) - 4.0)
            if r_idx + 1 < len(rows):
                next_top = min(o[2] for o in rows[r_idx + 1]) - 3.5
            else:
                next_top = q_bottom_y

            for c_idx, (lbl, lx0, ly0, lx1, ly1) in enumerate(row):
                bx0 = lx1 + 2.0
                bx1 = row[c_idx + 1][1] - 4.0 if c_idx + 1 < len(row) else col_right
                if next_top <= row_top + 6.0:
                    next_top = row_top + 16.0
                by_label[lbl] = ((lx0, ly0, lx1, ly1), (bx0, row_top, bx1, next_top))

        parsed_opts: List[ParsedOption] = []
        for idx, lbl in enumerate(("A", "B", "C", "D"), start=1):
            label_bbox, val_bbox = by_label[lbl]
            q_num_str = f"{self.paper_id}-opt-{len(parsed_opts)}"
            parsed_opts.append(
                ParsedOption(
                    option_number=idx,
                    option_id=q_num_str,
                    label=lbl.lower(),
                    page=pno,
                    label_bbox=label_bbox,
                    image_region=PageRegion(page=pno, bbox=val_bbox, xref=0),
                    text="",
                )
            )
        return parsed_opts

    def parse(self, doc: pymupdf.Document) -> ParsedPaper:
        """Sanitize document and parse all NEET 2026 MCQs."""
        clean_doc = self._sanitize_document(doc)
        start_p = int(self.eg_cfg["start_page"]) - 1
        end_p = int(self.eg_cfg["end_page"]) - 1
        col_left = float(self.eg_cfg.get("col_left_pt", 28.0))
        col_right = float(self.eg_cfg.get("col_right_pt", 505.0))
        y_max_pt = float(self.eg_cfg.get("y_max_pt", 758.0))

        questions: List[ParsedQuestion] = []

        for pno in range(start_p, end_p + 1):
            page = clean_doc[pno]
            d = page.get_text("dict", flags=0)

            q_headers: List[Tuple[int, Tuple[float, float, float, float]]] = []
            mcq_labels: List[Tuple[float, float, float, float]] = []
            opt_markers: List[Tuple[str, float, float, float, float]] = []
            footer_ys: List[float] = []

            for b in d["blocks"]:
                if b.get("type") != 0:
                    continue
                for line in b["lines"]:
                    txt = "".join(s["text"] for s in line["spans"]).strip()
                    lx0, ly0, lx1, ly1 = line["bbox"]

                    if "Keep practising on the" in txt:
                        footer_ys.append(ly0)
                        continue

                    mq = re.match(r"^Q(\d{1,3})\.$", txt)
                    if mq and lx0 < 80.0:
                        q_headers.append((int(mq.group(1)), (lx0, ly0, lx1, ly1)))
                        continue

                    if txt == "MCQ (Single Correct Answer)":
                        mcq_labels.append((lx0, ly0, lx1, ly1))
                        continue

                    mo = re.match(r"^\(([A-D])\)\b", txt)
                    if mo and lx0 < col_right:
                        opt_markers.append((mo.group(1), lx0, ly0, lx1, ly1))
                    else:
                        for span in line["spans"]:
                            ms = re.match(r"^\(([A-D])\)$", span["text"].strip())
                            if ms and span["bbox"][0] < col_right:
                                sx0, sy0, sx1, sy1 = span["bbox"]
                                opt_markers.append((ms.group(1), sx0, sy0, sx1, sy1))

            # Collect crisp non-branding text inside each question stem region for safety validation
            page_bottom_limit = min(footer_ys) - 16.0 if footer_ys else y_max_pt

            for i, (q_num, hbox) in enumerate(q_headers):
                next_q_y0 = q_headers[i + 1][1][1] if i + 1 < len(q_headers) else page_bottom_limit
                q_bottom = min(page_bottom_limit, next_q_y0 - 15.0)

                # Find matching MCQ subtitle on same header row
                matching_mcq = [m for m in mcq_labels if abs(m[1] - hbox[1]) <= 6.0]
                stem_y0 = (max(m[3] for m in matching_mcq) + 2.0) if matching_mcq else (hbox[3] + 2.0)

                # Gather option markers for this question
                raw_opts = [o for o in opt_markers if hbox[1] < o[2] < next_q_y0]
                seen_keys = set()
                uniq_opts = []
                for o in raw_opts:
                    k = (o[0], round(o[1], 1), round(o[2], 1))
                    if k not in seen_keys:
                        seen_keys.add(k)
                        uniq_opts.append(o)

                if len(uniq_opts) != 4 or {o[0] for o in uniq_opts} != {"A", "B", "C", "D"}:
                    raise ValueError(
                        f"Expected 4 options (A-D) for Q{q_num} on page {pno + 1}, got {uniq_opts}"
                    )

                min_opt_y = min(o[2] for o in uniq_opts)
                stem_y1 = min_opt_y - 3.5
                if stem_y1 <= stem_y0 + 6.0:
                    raise ValueError(f"Invalid stem height for Q{q_num} on page {pno + 1}")

                sec_id, subject = self._section_for_question(q_num)
                qid = f"{self.paper_id}-q{q_num:03d}"

                # Safety check: verify zero branding text inside clipped stem/option text
                stem_rect = pymupdf.Rect(col_left, stem_y0, col_right, stem_y1)
                stem_txt = page.get_text("text", clip=stem_rect, flags=0).strip()
                if FORBIDDEN_BRAND_RE.search(stem_txt):
                    raise RuntimeError(f"Branding text detected inside Q{q_num} stem: {stem_txt}")

                parsed_opts = self._compute_option_regions(pno, uniq_opts, stem_y1, q_bottom, col_right)
                for po in parsed_opts:
                    po.option_id = f"{qid}-opt{po.option_number}"
                    if po.image_region:
                        opt_txt = page.get_text(
                            "text", clip=pymupdf.Rect(*po.image_region.bbox), flags=0
                        ).strip()
                        if FORBIDDEN_BRAND_RE.search(opt_txt):
                            raise RuntimeError(
                                f"Branding text detected inside Q{q_num} opt {po.label}: {opt_txt}"
                            )

                questions.append(
                    ParsedQuestion(
                        question_number=q_num,
                        question_id=qid,
                        question_type="single_choice",
                        section_id=sec_id,
                        subject=subject,
                        source_pages=[pno],
                        header_bbox=hbox,
                        statement_images=[
                            PageRegion(page=pno, bbox=(col_left, stem_y0, col_right, stem_y1), xref=0)
                        ],
                        options=parsed_opts,
                        text="",
                    )
                )

        expected = int(self.config.get("total_questions", 180))
        if [q.question_number for q in questions] != list(range(1, expected + 1)):
            raise ValueError(
                f"Expected contiguous Q1..{expected} for {self.paper_id}, found {len(questions)}"
            )

        return ParsedPaper(
            exam_name=self.config.get("exam_name", "NEET UG"),
            total_questions=len(questions),
            questions=questions,
            raw_metadata={"sanitized": True},
            sanitized_doc=clean_doc,
        )
