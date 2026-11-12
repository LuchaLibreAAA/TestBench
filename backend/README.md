# Backend API

FastAPI service for the canonical Universal Q&A store, CBT export, and paper assets.

## Run

From the repository root, install `backend/requirements.txt`, set `backend/.env` from `.env.example`, then run:

```powershell
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Set a strong `ADMIN_TOKEN` before exposing the service. `ALLOW_INSECURE_DEV=1` enables the fixed local development token `dev`; never use that mode on a network.

## Seed

```powershell
python -m backend.scripts.seed --dir dist/qna
```

Each discovered `qna_database.json` is validated and upserted. Adjacent `images/` PNG assets are staged and copied after the database transaction commits.

## API

Public endpoints use `/api/v1`: `/health`, `/papers`, `/papers/{id}`, `/papers/{id}/download`, `/qna/{id}`, `/qna/{id}/questions`, and `/assets/{id}/{filename}`. Admin routes require `X-Admin-Token`:

```powershell
curl.exe -H "X-Admin-Token: $env:ADMIN_TOKEN" -F "pdf_file=@exam.pdf;type=application/pdf" http://localhost:8000/api/v1/admin/papers/upload
```

The upload response includes a `jobId`; poll `/api/v1/admin/jobs/{jobId}`. Admin routes also support answer-key PATCH and paper DELETE.

## Data and backup

SQLite and extracted assets live under `backend/data/` by default and are ignored by Git. Back up consistently with SQLite's online backup API (`sqlite3 app.db ".backup app-backup.db"`) and copy the matching `assets/` directory. Keep the database backup and assets from the same point in time.

If the frontend is served over HTTPS, serve the API over HTTPS as well to avoid mixed-content blocking.
