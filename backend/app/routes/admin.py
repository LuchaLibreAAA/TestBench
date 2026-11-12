"""Admin-only upload, job, answer-key, and deletion endpoints."""

import hashlib
import json
import re
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, Form, Response

from backend.app.db import get_db
from backend.app.models.api_models import AnswerPatchRequest, AnswerPatchResponse, JobCreatedResponse, JobResponse
from backend.app.security import require_admin
from backend.app.services.jobs import create_job, get_job, run_upload_job

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


@router.post("/papers/upload", status_code=202, response_model=JobCreatedResponse)
async def upload_pdf(background: BackgroundTasks, request: Request,
                     pdf_file: UploadFile = File(...), config: str = Form("jee_main")):
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
                    prefix += chunk[:5 - len(prefix)]
                target.write(chunk)
        if not prefix.startswith(b"%PDF-"):
            raise HTTPException(status_code=415, detail="Uploaded file is not a PDF")
        create_job(settings, job_id)
    except BaseException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise
    background.add_task(run_upload_job, settings, job_id, job_dir, config)
    return {"jobId": job_id}


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
            existing = {row["question_id"]: row for row in conn.execute("SELECT question_id,type,options_json FROM questions WHERE paper_id=?", (paper_id,))}
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
                if item.correctOptionId is None and item.correctNumericValue is None:
                    raise HTTPException(status_code=422, detail="Each answer needs an option ID or numeric value")
            for item in body.answers:
                answer = {"correctOptionId": item.correctOptionId, "correctNumericValue": item.correctNumericValue,
                          "isAnswerKeyAvailable": True}
                conn.execute("UPDATE questions SET answer_json=? WHERE paper_id=? AND question_id=?",
                             (json.dumps(answer, separators=(",", ":")), paper_id, item.questionId))
            row = conn.execute("SELECT content_hash,data_version FROM papers WHERE id=?", (paper_id,)).fetchone()
            digest = hashlib.sha256((row["content_hash"] + json.dumps([a.model_dump() for a in body.answers], sort_keys=True)).encode()).hexdigest()
            conn.execute("UPDATE papers SET content_hash=?,data_version=data_version+1,updated_at=datetime('now') WHERE id=?", (digest, paper_id))
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
