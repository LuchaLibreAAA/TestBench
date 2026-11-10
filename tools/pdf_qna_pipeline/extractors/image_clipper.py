"""Image clipping and post-processing for exam questions and options."""

import io
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
from PIL import Image
import pymupdf

from tools.pdf_qna_pipeline.parsers.base import PageRegion, ParsedPaper, ParsedQuestion, ParsedOption


def strip_alpha_and_convert_rgb(img: Image.Image) -> Image.Image:
    """Strip alpha channel and replace transparency with solid white background."""
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        alpha_img = img.convert("RGBA")
        background = Image.new("RGBA", alpha_img.size, (255, 255, 255, 255))
        composite = Image.alpha_composite(background, alpha_img)
        return composite.convert("RGB")
    return img.convert("RGB")


def trim_whitespace_and_pad(img: Image.Image, padding: int = 8, threshold: int = 245) -> Image.Image:
    """Trim pure white/near-white borders and add uniform white padding."""
    img_rgb = strip_alpha_and_convert_rgb(img)
    gray = img_rgb.convert("L")
    arr = np.array(gray)
    mask = arr < threshold

    if not np.any(mask):
        return img_rgb  # Image is entirely blank

    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]

    w, h = img_rgb.size
    left = max(0, int(cmin) - padding)
    top = max(0, int(rmin) - padding)
    right = min(w, int(cmax) + 1 + padding)
    bottom = min(h, int(rmax) + 1 + padding)

    cropped = img_rgb.crop((left, top, right, bottom))

    # Add extra padding if cropped touched original borders
    new_w = cropped.width + (padding if left == 0 else 0) + (padding if right == w else 0)
    new_h = cropped.height + (padding if top == 0 else 0) + (padding if bottom == h else 0)
    if new_w != cropped.width or new_h != cropped.height:
        padded = Image.new("RGB", (new_w, new_h), (255, 255, 255))
        paste_x = padding if left == 0 else 0
        paste_y = padding if top == 0 else 0
        padded.paste(cropped, (paste_x, paste_y))
        return padded

    return cropped


def is_valid_image(img: Image.Image, min_dim: int = 20, min_std: float = 5.0) -> Tuple[bool, str]:
    """Validate that image meets size and variance requirements."""
    w, h = img.size
    if w < min_dim or h < min_dim:
        return False, f"Image dimensions too small: ({w}x{h}) < {min_dim}"

    gray = img.convert("L")
    arr = np.array(gray)
    std = float(np.std(arr))
    if std <= min_std:
        return False, f"Image lacks contrast (pure white/black, stddev={std:.2f} <= {min_std})"

    return True, "Valid"


class ImageClipper:
    """Extracts, crops, trims, and saves question and option images."""

    def __init__(self, doc: pymupdf.Document, images_dir: Path, dpi: int = 300):
        self.doc = doc
        self.images_dir = images_dir
        self.dpi = dpi
        self.images_dir.mkdir(parents=True, exist_ok=True)

    def render_clip(self, page_num: int, bbox: Tuple[float, float, float, float]) -> Image.Image:
        """Render a clip bounding box from a page at configured DPI."""
        page = self.doc[page_num]
        rect = pymupdf.Rect(*bbox)
        pix = page.get_pixmap(clip=rect, dpi=self.dpi)
        img_bytes = pix.tobytes("png")
        return Image.open(io.BytesIO(img_bytes))

    def extract_region_image(self, region: PageRegion) -> Image.Image:
        """Extract embedded image if available (xref > 0), otherwise render clip."""
        if region.xref > 0:
            try:
                raw = self.doc.extract_image(region.xref)
                return Image.open(io.BytesIO(raw["image"]))
            except Exception:
                pass  # Fallback to clip render
        return self.render_clip(region.page, region.bbox)

    def process_and_save(self, img: Image.Image, filename: str) -> str:
        """Process image (alpha strip, trim, pad, validate) and save to disk."""
        processed = trim_whitespace_and_pad(img)
        valid, msg = is_valid_image(processed)
        if not valid:
            raise ValueError(f"Image validation failed for {filename}: {msg}")

        out_path = self.images_dir / filename
        processed.save(str(out_path), format="PNG", optimize=True)
        return f"images/{filename}"

    def extract_paper_images(self, paper: ParsedPaper) -> Dict[str, Any]:
        """Extract all images for questions and options in paper."""
        saved_paths: Dict[str, Any] = {"questions": {}, "options": {}}

        for q in paper.questions:
            q_paths: List[str] = []
            for idx, r in enumerate(q.statement_images):
                img = self.extract_region_image(r)
                suffix = f"_part{idx+1}" if len(q.statement_images) > 1 else ""
                fname = f"q_{q.question_id}{suffix}.png"
                rel_path = self.process_and_save(img, fname)
                q_paths.append(rel_path)
            saved_paths["questions"][q.question_id] = q_paths

            for opt in q.options:
                if opt.image_region:
                    img = self.extract_region_image(opt.image_region)
                    fname = f"opt_{opt.option_id}.png"
                    rel_path = self.process_and_save(img, fname)
                    saved_paths["options"][opt.option_id] = [rel_path]

        return saved_paths
