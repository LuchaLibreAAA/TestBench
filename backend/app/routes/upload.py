"""API route for uploading exam PDFs and executing extraction pipeline."""

import shutil
import tempfile
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import pymupdf

from backend.app.config import ASSETS_DIR
from backend.app.models.api_models import UploadResponse
from backend.app.repositories.paper_repo import PaperRepository
from backend.app.repositories.question_repo import QuestionRepository
from tools.pdf_qna_pipeline.config import load_config
from tools.pdf_qna_pipeline.parsers.nta_cbt import NtaCbtParser
from tools.pdf_qna_pipeline.extractors.image_clipper import ImageClipper
from tools.pdf_qna_pipeline.exporters.universal_qna import UniversalQnAExporter
from tools.pdf_qna_pipeline.exporters.testbench import TestBenchExporter

router = APIRouter(prefix="/papers", tags=["Ingestion"])

DEFAULT_CONFIG_PATH = Path("tools/pdf_qna_pipeline/configs/jee_main.yaml")


@router.post("/upload", response_model=UploadResponse)
async def upload_and_process_pdf(
    pdf_file: UploadFile = File(...),
    config_file: Optional[UploadFile] = File(None),
    paper_id: Optional[str] = Form(None),
):
    """Upload an exam PDF, run the extraction pipeline, and index questions in database."""
    if not pdf_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        temp_pdf = tmp_path / pdf_file.filename

        with open(temp_pdf, "wb") as f:
            shutil.copyfileobj(pdf_file.file, f)

        # Config handling
        if config_file:
            temp_cfg = tmp_path / "config.yaml"
            with open(temp_cfg, "wb") as f:
                shutil.copyfileobj(config_file.file, f)
            config = load_config(temp_cfg)
        else:
            config = load_config(DEFAULT_CONFIG_PATH)

        # Run pipeline
        try:
            doc = pymupdf.open(str(temp_pdf))
            parser = NtaCbtParser(config)
            paper = parser.parse(doc)

            resolved_paper_id = paper_id or "jee-main-2026-apr-s2"
            paper_assets_dir = ASSETS_DIR / resolved_paper_id
            paper_assets_dir.mkdir(parents=True, exist_ok=True)

            clipper = ImageClipper(doc, paper_assets_dir)
            image_paths = clipper.extract_paper_images(paper)

            # Export Q&A DB
            uni_exporter = UniversalQnAExporter(config)
            qna_db = uni_exporter.build_database(paper, image_paths, source_pdf_name=pdf_file.filename)
            QuestionRepository.save_qna_database(resolved_paper_id, qna_db.model_dump())

            # Export TestBench Paper
            tb_exporter = TestBenchExporter(config)
            tb_paper_dict = tb_exporter.build_paper_dict(paper, image_paths)
            tb_paper_dict["id"] = resolved_paper_id
            PaperRepository.save_paper(tb_paper_dict)

            return UploadResponse(
                success=True,
                paperId=resolved_paper_id,
                totalQuestions=len(paper.questions),
                message=f"Successfully extracted and indexed {len(paper.questions)} questions.",
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Pipeline processing failed: {str(e)}")
