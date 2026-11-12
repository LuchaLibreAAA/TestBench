"""Scanned WBTET bilingual & two-column booklet PDF parser."""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple
import cv2
import numpy as np
import pymupdf

from .base import BaseParser, PageRegion, ParsedOption, ParsedPaper, ParsedQuestion


class WbtetScannedParser(BaseParser):
    """Parser for scanned WB Primary TET booklets with deskewing and bilingual cropping."""

    OPTION_LABELS = ("a", "b", "c", "d")

    def __init__(self, config: dict):
        self.config = config
        self.exam_name: str = config.get("exam_name", "WBTET")
        self.exam_slug: str = config.get("exam_slug", "wbtet")
        self.paper_id: str = config.get("paper_id", "wbtet")
        self.total_questions: int = int(config.get("total_questions", 150))
        self.deskew_dpi: int = int(config.get("deskew_dpi", 240))
        self.header_mask_y_pt: float = float(config.get("header_mask_y_pt", 30.0))
        self.footer_mask_y_pt: float = float(config.get("footer_mask_y_pt", 785.0))

        self.section_by_q: Dict[int, dict] = {}
        for sec in config.get("sections", []):
            if "q_range" in sec:
                sq, eq = int(sec["q_range"][0]), int(sec["q_range"][1])
            else:
                sq, eq = int(sec["start_q"]), int(sec["end_q"])
            for qn in range(sq, eq + 1):
                self.section_by_q[qn] = sec

    def parse(self, doc: pymupdf.Document) -> ParsedPaper:
        """Deskew pages in memory and extract localized question/passage regions."""
        sanitized_doc, page_arrays, page_sizes = self._build_sanitized_doc(doc)

        # Map each question number to attached comprehension passage regions (0-indexed pages).
        passage_regions_by_q: Dict[int, List[PageRegion]] = {}
        for p_cfg in self.config.get("passages", []):
            q_start, q_end = int(p_cfg["q_range"][0]), int(p_cfg["q_range"][1])
            regs = [
                PageRegion(
                    page=int(r["page"]) - 1,
                    bbox=tuple(float(v) for v in r["bbox"]),  # type: ignore[arg-type]
                    xref=0,
                )
                for r in p_cfg.get("regions", [])
            ]
            for qn in range(q_start, q_end + 1):
                passage_regions_by_q.setdefault(qn, []).extend(regs)

        en_regions: Dict[int, List[PageRegion]] = {}
        bn_regions: Dict[int, List[PageRegion]] = {}
        seq_regions: Dict[int, List[PageRegion]] = {}
        primary_page_by_q: Dict[int, int] = {}

        for page_cfg in self.config.get("pages", []):
            pno = int(page_cfg["page"]) - 1
            img = page_arrays[pno]
            w_pt, h_pt = page_sizes[pno]
            layout = page_cfg["layout"]

            if layout == "bilingual":
                q_start = int(page_cfg["q_start"])
                q_end = int(page_cfg["q_end"])
                count = q_end - q_start + 1
                en_x = tuple(float(v) for v in page_cfg.get("en_x", [18.0, 290.0]))
                bn_x = tuple(float(v) for v in page_cfg.get("bn_x", [295.0, 576.0]))
                y_range = tuple(float(v) for v in page_cfg.get("y_range", [90.0, 770.0]))
                en_yr = tuple(float(v) for v in page_cfg.get("en_y_range", y_range))
                bn_yr = tuple(float(v) for v in page_cfg.get("bn_y_range", y_range))

                en_boxes = self._segment_column(
                    img, w_pt, h_pt, en_x, en_yr, count, page_cfg.get("en_y_splits"),
                )
                bn_boxes = self._segment_column(
                    img, w_pt, h_pt, bn_x, bn_yr, count, page_cfg.get("bn_y_splits"),
                )
                for idx in range(count):
                    qn = q_start + idx
                    primary_page_by_q[qn] = pno
                    en_regions.setdefault(qn, []).append(
                        PageRegion(page=pno, bbox=en_boxes[idx], xref=0)
                    )
                    bn_regions.setdefault(qn, []).append(
                        PageRegion(page=pno, bbox=bn_boxes[idx], xref=0)
                    )

            elif layout == "two_column":
                for col_cfg in page_cfg.get("columns", []):
                    q_start = int(col_cfg["q_start"])
                    q_end = int(col_cfg["q_end"])
                    count = q_end - q_start + 1
                    xr = tuple(float(v) for v in col_cfg["x_range"])
                    yr = tuple(float(v) for v in col_cfg["y_range"])
                    boxes = self._segment_column(
                        img, w_pt, h_pt, xr, yr, count, col_cfg.get("y_splits"),
                    )
                    for idx in range(count):
                        qn = q_start + idx
                        primary_page_by_q[qn] = pno
                        seq_regions.setdefault(qn, []).append(
                            PageRegion(page=pno, bbox=boxes[idx], xref=0)
                        )
            else:
                raise ValueError(f"Unsupported WBTET page layout '{layout}' on page {pno + 1}")

        questions: List[ParsedQuestion] = []
        localized_image_indices: Dict[str, Dict[str, List[int]]] = {}

        for qn in range(1, self.total_questions + 1):
            if qn not in primary_page_by_q:
                raise ValueError(f"Missing WBTET question Q{qn} after parsing all pages")
            sec = self.section_by_q.get(qn)
            if not sec:
                raise ValueError(f"Question Q{qn} does not belong to any configured section")

            qid = f"{self.paper_id}-q{qn:03d}"
            p_regs = passage_regions_by_q.get(qn, [])

            stmt_images: List[PageRegion] = []
            if qn in en_regions and qn in bn_regions:
                p_indices = list(range(len(p_regs)))
                stmt_images.extend(p_regs)
                en_start = len(stmt_images)
                stmt_images.extend(en_regions[qn])
                en_indices = p_indices + list(range(en_start, len(stmt_images)))

                bn_start = len(stmt_images)
                stmt_images.extend(bn_regions[qn])
                bn_indices = p_indices + list(range(bn_start, len(stmt_images)))
                localized_image_indices[qid] = {"en": en_indices, "bn": bn_indices}
            elif qn in seq_regions:
                stmt_images.extend(p_regs)
                stmt_images.extend(seq_regions[qn])
            else:
                raise ValueError(f"Incomplete column regions for Q{qn}")

            primary_bbox = stmt_images[len(p_regs)].bbox
            source_pages = sorted({r.page + 1 for r in stmt_images})
            pno = primary_page_by_q[qn]

            options = [
                ParsedOption(
                    option_number=idx + 1,
                    option_id=f"{qid}_opt_{lbl}",
                    label=lbl,
                    page=pno,
                    label_bbox=primary_bbox,
                    image_region=None,
                    text=f"Option {lbl.upper()}",
                )
                for idx, lbl in enumerate(self.OPTION_LABELS)
            ]

            questions.append(
                ParsedQuestion(
                    question_number=qn,
                    question_id=qid,
                    question_type="single_choice",
                    section_id=sec["id"],
                    subject=sec["subject"],
                    source_pages=source_pages,
                    header_bbox=primary_bbox,
                    statement_images=stmt_images,
                    options=options,
                    text=f"Question {qn}",
                )
            )

        return ParsedPaper(
            exam_name=self.exam_name,
            total_questions=len(questions),
            questions=questions,
            raw_metadata={
                "source_type": "wbtet_scanned",
                "localized_image_indices": localized_image_indices,
            },
            sanitized_doc=sanitized_doc,
        )

    def _build_sanitized_doc(
        self, doc: pymupdf.Document
    ) -> Tuple[pymupdf.Document, List[np.ndarray], List[Tuple[float, float]]]:
        """Render, deskew, and mask scanner/watermark footers into an in-memory PDF."""
        sanitized = pymupdf.open()
        arrays: List[np.ndarray] = []
        sizes: List[Tuple[float, float]] = []
        zoom = self.deskew_dpi / 72.0

        for page in doc:
            rect = page.rect
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
            rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).copy()

            clean = self._deskew_page(rgb)
            top_px = max(0, int(self.header_mask_y_pt * zoom))
            bot_px = min(clean.shape[0], int(self.footer_mask_y_pt * zoom))
            if top_px > 0:
                clean[:top_px, :] = 255
            if bot_px < clean.shape[0]:
                clean[bot_px:, :] = 255

            ok, buf = cv2.imencode(".png", cv2.cvtColor(clean, cv2.COLOR_RGB2BGR))
            if not ok:
                raise RuntimeError("Failed to encode deskewed WBTET page")

            out_page = sanitized.new_page(width=rect.width, height=rect.height)
            out_page.insert_image(out_page.rect, stream=buf.tobytes())

            arrays.append(clean)
            sizes.append((rect.width, rect.height))

        return sanitized, arrays, sizes

    def _deskew_page(self, rgb: np.ndarray) -> np.ndarray:
        """Estimate page skew in [-4.0, +4.0] degrees via projection variance and rotate cleanly."""
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        h, w = gray.shape
        # Ignore outer 10% margins so scanner frame lines don't bias angle estimation.
        roi = gray[int(h * 0.08):int(h * 0.90), int(w * 0.06):int(w * 0.94)]
        small = cv2.resize(roi, (0, 0), fx=0.4, fy=0.4, interpolation=cv2.INTER_AREA)
        bw = (small < 190).astype(np.uint8)

        def score_angle(angle: float) -> float:
            sh, sw = bw.shape
            m = cv2.getRotationMatrix2D((sw / 2.0, sh / 2.0), angle, 1.0)
            rot = cv2.warpAffine(bw, m, (sw, sh), flags=cv2.INTER_NEAREST, borderValue=0)
            proj = rot.sum(axis=1).astype(np.float64)
            return float(np.var(proj))

        best_coarse = max((-4.0 + i * 0.5 for i in range(17)), key=score_angle)
        best_angle = max((best_coarse - 0.5 + i * 0.1 for i in range(11)), key=score_angle)
        if abs(best_angle) < 0.08:
            return rgb

        m_full = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), best_angle, 1.0)
        return cv2.warpAffine(
            rgb,
            m_full,
            (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255),
        )

    def _segment_column(
        self,
        rgb: np.ndarray,
        w_pt: float,
        h_pt: float,
        x_range: Tuple[float, float],
        y_range: Tuple[float, float],
        expected_count: int,
        explicit_splits: Optional[List[float]] = None,
    ) -> List[Tuple[float, float, float, float]]:
        """Slice a column into exactly `expected_count` question bounding boxes."""
        x0, x1 = x_range
        y0, y1 = y_range

        if explicit_splits is not None:
            if len(explicit_splits) != expected_count + 1:
                raise ValueError(
                    f"explicit y_splits length {len(explicit_splits)} != expected {expected_count + 1}"
                )
            return [
                (x0, float(explicit_splits[i]), x1, float(explicit_splits[i + 1]))
                for i in range(expected_count)
            ]

        if expected_count <= 0:
            return []
        if expected_count == 1:
            return [(x0, y0, x1, y1)]

        sx = rgb.shape[1] / w_pt
        sy = rgb.shape[0] / h_pt
        px0 = max(0, int(x0 * sx))
        px1 = min(rgb.shape[1], int(x1 * sx))
        py0 = max(0, int(y0 * sy))
        py1 = min(rgb.shape[0], int(y1 * sy))

        crop_gray = cv2.cvtColor(rgb[py0:py1, px0:px1], cv2.COLOR_RGB2GRAY)
        # Ignore faint gray watermarks (e.g. www.kolom.in ~185-225) and strip full-height divider rules.
        dark = crop_gray < 158
        if dark.shape[0] > 40:
            col_frac = dark.mean(axis=0)
            rule_cols = col_frac > 0.35
            if rule_cols.any():
                dark[:, rule_cols] = False

        row_ink = dark.sum(axis=1)
        ink_rows = np.where(row_ink >= 2)[0]
        if len(ink_rows) == 0:
            return [(x0, y0, x1, y1)]

        content_top_pt = max(y0, y0 + int(ink_rows[0]) / sy - 2.0)
        content_bot_pt = min(y1, y0 + int(ink_rows[-1]) / sy + 3.0)

        # Estimate the flush-left text margin inside this column (ignoring tiny edge specks).
        col_ink = dark.sum(axis=0)
        active_cols = np.where(col_ink >= 8)[0]
        margin_px = int(active_cols[0]) if len(active_cols) else 0
        gutter_end_px = min(dark.shape[1], margin_px + int(22.0 * sx))
        indent_check_px = min(dark.shape[1], margin_px + int(11.0 * sx))

        is_blank = row_ink <= 1
        gaps: List[Tuple[float, float, float]] = []  # (mid_pt, gap_len_pt, score)
        i = int(ink_rows[0])
        last_ink = int(ink_rows[-1])

        while i <= last_ink:
            if not is_blank[i]:
                i += 1
                continue
            j = i
            while j <= last_ink and is_blank[j]:
                j += 1
            gap_len_pt = (j - i) / sy
            if gap_len_pt >= 3.2 and i > int(ink_rows[0]) and j <= last_ink:
                mid_pt = y0 + ((i + j) * 0.5) / sy
                below_end = min(last_ink + 1, j + int(14.0 * sy))
                # A true question boundary starts flush at margin_px (question number like "14.").
                gutter_ink = int(dark[j:below_end, margin_px:gutter_end_px].sum())
                starts_flush = int(dark[j:below_end, margin_px:indent_check_px].sum()) >= 5
                score = gap_len_pt + (14.0 if starts_flush else -8.0) + min(gutter_ink, 40) * 0.05
                gaps.append((mid_pt, gap_len_pt, score))
            i = j

        # Pick top `expected_count - 1` gaps respecting minimum question height (~28 pt).
        gaps_sorted = sorted(gaps, key=lambda g: g[2], reverse=True)
        chosen: List[float] = []
        for mid_pt, _, _ in gaps_sorted:
            if mid_pt - content_top_pt < 26.0 or content_bot_pt - mid_pt < 26.0:
                continue
            if any(abs(mid_pt - c) < 26.0 for c in chosen):
                continue
            chosen.append(mid_pt)
            if len(chosen) == expected_count - 1:
                break

        if len(chosen) < expected_count - 1:
            # Fallback to uniform splits if heavy handwriting bridges gaps; calibration script flags this.
            step = (content_bot_pt - content_top_pt) / expected_count
            boundaries = [content_top_pt + step * k for k in range(expected_count + 1)]
        else:
            chosen.sort()
            boundaries = [content_top_pt, *chosen, content_bot_pt]

        return [
            (x0, float(boundaries[k]), x1, float(boundaries[k + 1]))
            for k in range(expected_count)
        ]
