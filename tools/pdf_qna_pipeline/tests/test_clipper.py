"""Tests for Stage 3 Image Clipper."""

from pathlib import Path
import pymupdf
import pytest
from PIL import Image
import numpy as np

from tools.pdf_qna_pipeline.config import load_config
from tools.pdf_qna_pipeline.parsers.nta_cbt import NtaCbtParser
from tools.pdf_qna_pipeline.extractors.image_clipper import ImageClipper

PDF_PATH = Path("testbench/Jee main 2026/JEE-Main-2026-Question-Paper-B-Tech-2nd-Apr-Shift-2.pdf")
CONFIG_PATH = Path("tools/pdf_qna_pipeline/configs/jee_main.yaml")


def test_image_clipper_extracts_all_images(tmp_path):
    """Test extracting all 75 question images and 240 option images."""
    config = load_config(CONFIG_PATH)
    parser = NtaCbtParser(config)
    doc = pymupdf.open(str(PDF_PATH))
    paper = parser.parse(doc)

    images_dir = tmp_path / "images"
    clipper = ImageClipper(doc, images_dir)
    image_paths = clipper.extract_paper_images(paper)

    # Check question images
    assert len(image_paths["questions"]) == 75
    # Check option images
    assert len(image_paths["options"]) == 240

    # Verify every question file on disk
    for q_id, paths in image_paths["questions"].items():
        assert len(paths) >= 1
        for p in paths:
            file_on_disk = tmp_path / p
            assert file_on_disk.exists(), f"Missing question image: {file_on_disk}"
            assert file_on_disk.stat().st_size > 500
            with Image.open(file_on_disk) as img:
                assert img.width >= 20 and img.height >= 20
                arr = np.array(img.convert("L"))
                assert float(np.std(arr)) > 5.0

    # Verify every option file on disk
    for opt_id, paths in image_paths["options"].items():
        assert len(paths) == 1
        file_on_disk = tmp_path / paths[0]
        assert file_on_disk.exists(), f"Missing option image: {file_on_disk}"
        assert file_on_disk.stat().st_size > 500
        with Image.open(file_on_disk) as img:
            assert img.width >= 20 and img.height >= 20
            arr = np.array(img.convert("L"))
            assert float(np.std(arr)) > 5.0
