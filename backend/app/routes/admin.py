"""Admin-only upload, job, answer-key, ingestion, and management endpoints."""

import hashlib
import json
import re
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, Response, UploadFile

from backend.app.db import get_db
from backend.app.models.api_models import (
    AdminAssetReplaceResponse,
    AdminExamRequest,
    AdminPaperPatchRequest,
    AnswerPatchRequest,
    AnswerPatchResponse,
    JobCreatedResponse,
    JobResponse,
)
from backend.app.security import require_admin
from backend.app.services.ingest import ingest_zip, replace_single_asset
from backend.app.services.jobs import create_job, get_job, run_upload_job

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


@router.post("/papers/upload", status_code=202, response_model=JobCreatedResponse)
async def upload_pdf(
    background: BackgroundTasks,
    request: Request,
    pdf_file: UploadFile = File(...),
    config: str = Form("jee_main"),
):
    settings = request.app.state.settings
    if pdf_file.content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Expected application/pdf")
    if not re.fullmatch(r"[a-z0-9_-]{1,64}", config):
        raise HTTPException(status_code=422, detail="Invalid config name")
    job_id = str(uuid.uuid4())
    job_dir = settings.db_path.parent / "jobs" / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    pdf_path = job_dir / "upload.pdf"
    total = 0
    prefix = b""
    try:
        with pdf_path.open("wb") as target:
            while chunk := await pdf_file.read(1024 * 1024):
                total += len(chunk)
                if total > settings.max_upload_mb * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="PDF exceeds upload limit")
                if len(prefix) < 5:
                    prefix += chunk[: 5 - len(prefix)]
                target.write(chunk)
        if not prefix.startswith(b"%PDF-"):
            raise HTTPException(status_code=415, detail="Uploaded file is not a PDF")
        create_job(settings, job_id)
    except BaseException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise
    background.add_task(run_upload_job, settings, job_id, job_dir, config)
    return {"jobId": job_id}


@router.post("/papers/ingest")
async def ingest_paper_archive(
    request: Request,
    archive: UploadFile = File(...),
):
    """Ingest a zipped qna_database.json + images/ package."""
    settings = request.app.state.settings
    data = await archive.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archive exceeds upload limit")

    result = ingest_zip(data, settings)
    if result.status == "failed":
        raise HTTPException(status_code=422, detail=result.reason or "Ingestion failed")

    return {
        "status": result.status,
        "paperId": result.paper_id,
        "dataVersion": result.data_version,
    }


@router.put("/papers/{paper_id}/assets/{filename}", response_model=AdminAssetReplaceResponse)
async def replace_paper_asset(
    paper_id: str,
    filename: str,
    request: Request,
    asset_file: UploadFile = File(...),
):
    """Replace an individual asset screenshot, bumping data_version and rebuilding package."""
    settings = request.app.state.settings
    data = await asset_file.read()
    try:
        res = replace_single_asset(paper_id, filename, data, settings)
        return {
            "paperId": res["paper_id"],
            "filename": res["filename"],
            "sha256": res["sha256"],
            "dataVersion": res["data_version"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/exams")
def create_or_update_exam(body: AdminExamRequest, request: Request):
    """Create or update an exam definition in the registry."""
    settings = request.app.state.settings
    with get_db(settings) as conn:
        with conn:
            conn.execute(
                """INSERT INTO exams(code, name, badge, default_marking_strategy, pipeline_config, config_json, position, active)
                   VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(code) DO UPDATE SET
                   name=excluded.name, badge=excluded.badge,
                   default_marking_strategy=excluded.default_marking_strategy,
                   pipeline_config=excluded.pipeline_config,
                   config_json=excluded.config_json,
                   position=excluded.position, active=excluded.active""",
                (body.code, body.name, body.badge, body.defaultMarkingStrategy,
                 body.pipelineConfig, body.configJson or "{}", body.position, body.active),
            )
    return {"status": "ok", "code": body.code}


@router.patch("/papers/{paper_id}")
def update_paper(paper_id: str, body: AdminPaperPatchRequest, request: Request):
    """Update paper metadata or publishing status."""
    settings = request.app.state.settings
    with get_db(settings) as conn:
        with conn:
            row = conn.execute("SELECT id FROM papers WHERE id=?", (paper_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Paper not found")

            updates = []
            params = []
            if body.title is not None:
                updates.append("title = ?")
                params.append(body.title)
            if body.status is not None:
                updates.append("status = ?")
                params.append(body.status)
            if body.examCode is not None:
                updates.append("exam_code = ?")
                params.append(body.examCode)
            if body.minClientVersion is not None:
                updates.append("min_client_version = ?")
                params.append(body.minClientVersion)
            if body.requiredFeatures is not None:
                updates.append("required_features = ?")
                params.append(json.dumps(body.requiredFeatures))

            if updates:
                updates.append("updated_at = datetime('now')")
                params.append(paper_id)
                conn.execute(f"UPDATE papers SET {', '.join(updates)} WHERE id = ?", params)

    return {"status": "ok", "paperId": paper_id}


@router.get("/jobs/{job_id}", response_model=JobResponse)
def job_status(job_id: str, request: Request):
    result = get_job(request.app.state.settings, job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return result


@router.patch("/papers/{paper_id}/answers", response_model=AnswerPatchResponse)
def patch_answers(paper_id: str, body: AnswerPatchRequest, request: Request):
    settings = request.app.state.settings
    if not body.answers:
        raise HTTPException(status_code=422, detail="At least one answer is required")
    with get_db(settings) as conn:
        with conn:
            if conn.execute("SELECT 1 FROM papers WHERE id=?", (paper_id,)).fetchone() is None:
                raise HTTPException(status_code=404, detail="Paper not found")
            existing = {
                row["question_id"]: row
                for row in conn.execute(
                    "SELECT question_id,type,options_json FROM questions WHERE paper_id=?", (paper_id,)
                )
            }
            ids = [item.questionId for item in body.answers]
            if len(set(ids)) != len(ids) or any(question_id not in existing for question_id in ids):
                raise HTTPException(status_code=422, detail="Answers contain duplicate or unknown question IDs")
            for item in body.answers:
                options = json.loads(existing[item.questionId]["options_json"])
                question_type = existing[item.questionId]["type"]
                if question_type == "single_choice" and (item.correctOptionId is None or item.correctNumericValue is not None):
                    raise HTTPException(status_code=422, detail=f"Expected a choice answer for question {item.questionId}")
                if question_type == "numeric" and (item.correctNumericValue is None or item.correctOptionId is not None):
                    raise HTTPException(status_code=422, detail=f"Expected a numeric answer for question {item.questionId}")
                if item.correctOptionId and item.correctOptionId not in {o["optionId"] for o in options}:
                    raise HTTPException(status_code=422, detail=f"Unknown option for question {item.questionId}")
                if item.correctOptionId is None and item.correctNumericValue is None and item.correctOptionIds is None and item.correctBooleanValue is None:
                    raise HTTPException(status_code=422, detail="Each answer needs an answer value")
            for item in body.answers:
                answer = {
                    "correctOptionId": item.correctOptionId,
                    "correctNumericValue": item.correctNumericValue,
                    "correctOptionIds": item.correctOptionIds,
                    "correctBooleanValue": item.correctBooleanValue,
                    "isAnswerKeyAvailable": True,
                }
                conn.execute(
                    "UPDATE questions SET answer_json=? WHERE paper_id=? AND question_id=?",
                    (json.dumps(answer, separators=(",", ":")), paper_id, item.questionId),
                )
            row = conn.execute("SELECT content_hash,data_version FROM papers WHERE id=?", (paper_id,)).fetchone()
            digest = hashlib.sha256(
                (row["content_hash"] + json.dumps([a.model_dump() for a in body.answers], sort_keys=True)).encode()
            ).hexdigest()
            conn.execute(
                "UPDATE papers SET content_hash=?,data_version=data_version+1,updated_at=datetime('now') WHERE id=?",
                (digest, paper_id),
            )
    return {"updated": len(body.answers)}


@router.delete("/papers/{paper_id}", status_code=204)
def delete_paper(paper_id: str, request: Request):
    settings = request.app.state.settings
    with get_db(settings) as conn:
        with conn:
            conn.execute("DELETE FROM questions_fts WHERE paper_id=?", (paper_id,))
            cursor = conn.execute("DELETE FROM papers WHERE id=?", (paper_id,))
            if not cursor.rowcount:
                raise HTTPException(status_code=404, detail="Paper not found")
    shutil.rmtree(settings.assets_dir / paper_id, ignore_errors=True)
    return Response(status_code=204)
