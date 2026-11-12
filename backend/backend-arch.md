# Backend Architecture Plan (v2): Standalone Question & Mock Exam API

**Audience:** the LLM/developer implementing this (possibly a low-end model now, a stronger one later). Every stage has exact inputs, outputs, and pass/fail checks. Do stages in order; do not start one until the previous one's checks pass.

---

## 0. What Changed vs v1 and Why

| Problem in v1 | Fix in v2 |
|---|---|
| `GET /assets/{paper_id}/{filename}` is open to **path traversal** (`../../app.db`) | Strict ID/filename regex plus resolved-path containment check, with a test |
| `POST /upload` is unauthenticated and runs a heavy pipeline **inside the request** (timeouts, DoS, arbitrary file upload) | Admin token, size/type limits, **background job** with `GET /jobs/{id}` status |
| Same data stored twice (`papers.data_json` and `questions` rows) with no rule for which is canonical | **Single source of truth**: the Universal Q&A JSON. The CBT paper JSON is *derived* by the exporter and cached |
| Diagram shows a `sections` table, but the schema never defines it | `sections` table added |
| Seeding was not idempotent; re-running could duplicate or fail | Upsert by `paper_id` in one transaction, with a content hash |
| No error format, no response models, no versioning of data | Standard error envelope, Pydantic response models, `dataVersion` + ETag |
| SQLite defaults (no foreign keys, no WAL) | PRAGMAs set on every connection |
| "Seamless offline fallback" was undefined | Explicit client caching rules (section 7) |
| Search over `LIKE` only | Number/ID search now, **FTS5 table** created for later (when OCR text is filled in) |
| Stage 2 seeds papers (2024, 2023, NEET) that may not exist as pipeline outputs yet | Seeder reads **whatever is in `dist/qna/*`**; it never hardcodes papers |
| No health endpoint (the UI badge needs one) | `GET /api/v1/health` |
| No auth/CORS policy | CORS allowlist from env; public GETs, admin-only writes |

---

## 1. Objective and Scope

A standalone service that is the **single source of truth** for exam papers, questions, and image assets, serving them over a versioned REST API.

**In scope:** read API for papers/questions/assets, admin ingestion (seed + upload), health, tests, frontend wiring with offline cache.
**Out of scope (for now):** user accounts, attempt history/scoring storage, payments, multi-tenant admin UI, non-SQLite databases.

```
                 ┌────────────────────────────────────────────┐
 dist/qna/*  ──► │  Seeder / Upload job (uses pdf_qna_pipeline)│
                 └──────────────────┬─────────────────────────┘
                                    ▼
┌──────────────────────────────────────────────────────────────┐
│ BACKEND (FastAPI + SQLite + Pydantic)                        │
│  SQLite: papers · sections · questions · jobs · questions_fts│
│  Files : backend/data/assets/{paper_id}/*.png                │
│  Public GET API  ·  Admin-only POST/PATCH (X-Admin-Token)    │
└──────────────────────────────┬───────────────────────────────┘
                               ▼ JSON + PNG (ETag, Cache-Control)
┌──────────────────────────────────────────────────────────────┐
│ FRONTEND (React 19 + TS + Vite): Library · CBT Player ·      │
│ Q&A Explorer · Dexie offline cache                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Design Rules (read before coding)

1. **One canonical store.** Universal Q&A data lives in `questions`/`sections`/`papers`. Anything else (CBT JSON, downloads) is generated from it.
2. **Config via environment** (`backend/.env`, loaded by `pydantic-settings`): `DB_PATH`, `ASSETS_DIR`, `ADMIN_TOKEN`, `CORS_ORIGINS`, `MAX_UPLOAD_MB`. No secrets or paths hardcoded.
3. **Never trust path input.** Any path built from request data goes through the safe-path helper (section 6.3).
4. **Pydantic models for every request and response.** No raw dicts returned from routes.
5. **Thin routes, logic in `services/`, SQL in `repositories/`.** Routes contain no SQL.
6. **Fail with the standard error envelope** (section 5.1). Never leak stack traces.
7. **Idempotent writes.** Re-running seed/upload for the same paper must be safe.
8. **Small functions, type hints, docstrings.** Each function under about 40 lines.

---

## 3. Tech Stack

| Component | Choice | Notes |
|---|---|---|
| Framework | FastAPI 0.115.x + Uvicorn | Already installed; pin in `backend/requirements.txt` |
| Validation/settings | Pydantic v2 + `pydantic-settings` | Reuse models from `tools/pdf_qna_pipeline/models.py` by making `tools` importable (`pip install -e .` with a `pyproject.toml`, **not** `sys.path` hacks) |
| Database | SQLite (stdlib `sqlite3`) | Per-request connection via dependency; WAL mode |
| Static files | `FileResponse` with explicit headers | Not `StaticFiles` mount (we need validation and ETag control) |
| Tests | `pytest` + `httpx` + FastAPI `TestClient` | Temp DB and temp assets dir per test session |
| Lint (optional) | `ruff` | |

SQLite is a good fit while there is one server process and mostly reads. Revisit PostgreSQL only if you need multiple writers or many concurrent uploads.

---

## 4. Project Layout

```
backend/
├── pyproject.toml / requirements.txt
├── .env.example
├── app/
│   ├── main.py              # app factory, CORS, routers, error handlers
│   ├── settings.py          # pydantic-settings
│   ├── db.py                # connect(), PRAGMAs, migrate()
│   ├── migrations/
│   │   └── 001_init.sql
│   ├── schemas/             # Pydantic request/response models
│   ├── repositories/        # SQL only: papers.py, questions.py, jobs.py
│   ├── services/
│   │   ├── ingest.py        # qna folder -> DB (upsert)
│   │   ├── cbt_export.py    # DB -> TestBench PaperSchema JSON
│   │   ├── assets.py        # safe path + file response helpers
│   │   └── jobs.py          # background pipeline runner
│   ├── routers/
│   │   ├── health.py  papers.py  qna.py  assets.py  admin.py
│   └── security.py          # admin token dependency
├── scripts/
│   └── seed.py              # python -m backend.scripts.seed [--dir dist/qna]
├── data/                    # app.db, assets/ (gitignored)
└── tests/
    ├── conftest.py          # temp DB + tiny fixture paper
    ├── test_health.py  test_papers.py  test_qna.py
    ├── test_assets_security.py  test_admin.py  test_ingest.py
    └── fixtures/mini_paper/ # 3 questions, 2 tiny PNGs, valid qna_database.json
```

---

## 5. API Contract (v1)

Base path: `/api/v1`. All JSON UTF-8. Public GETs need no auth. Writes require header `X-Admin-Token: <ADMIN_TOKEN>`.

### 5.1 Error envelope (all errors)
```json
{ "error": { "code": "not_found", "message": "Paper 'xyz' does not exist", "details": null } }
```
Codes: `not_found` (404), `validation_error` (422), `unauthorized` (401), `payload_too_large` (413), `unsupported_media_type` (415), `conflict` (409), `internal_error` (500).

### 5.2 Endpoints

| Method + Path | Auth | Purpose | Success response |
|---|---|---|---|
| `GET /health` | no | Liveness for the UI badge | `{"status":"ok","apiVersion":"v1","dbOk":true}` |
| `GET /papers` | no | Catalog | `{"items":[PaperSummary...]}` |
| `GET /papers/{paper_id}` | no | Derived CBT (TestBench) paper JSON | `PaperSchema` + ETag |
| `GET /papers/{paper_id}/download` | no | Same JSON as attachment | header `Content-Disposition: attachment; filename="{paper_id}.json"` |
| `GET /qna/{paper_id}` | no | Complete Universal Q&A JSON (schema v1.0 from the pipeline plan) | `UniversalQna` + ETag |
| `GET /qna/{paper_id}/questions` | no | Filter + paginate | `{"items":[...],"page":1,"limit":25,"total":75,"pages":3}` |
| `GET /assets/{paper_id}/{filename}` | no | Stream PNG | `image/png`, ETag, `Cache-Control: public, max-age=31536000, immutable` |
| `POST /admin/papers/upload` | admin | Upload PDF, start job | `202 {"jobId":"..."}` |
| `GET /admin/jobs/{job_id}` | admin | Poll job | `{"status":"queued|running|done|failed","paperId":null,"error":null}` |
| `PATCH /admin/papers/{paper_id}/answers` | admin | Attach answer key (see 5.4) | `{"updated": 75}` |
| `DELETE /admin/papers/{paper_id}` | admin | Remove paper and its assets | `204` |

*(Upload moved under `/admin` so every write is visibly admin-only.)*

### 5.3 Query parameters for `GET /qna/{paper_id}/questions`
- `subject`: one of `Mathematics|Physics|Chemistry` (validated against values present in that paper; unknown gives empty result, not an error)
- `type`: `single_choice|numeric`
- `section`: section id (e.g. `math-a`)
- `search`: matches `question_number` exactly, or `question_id` as substring. If FTS text exists, also matches text.
- `page` (>=1, default 1), `limit` (1..100, default 25)
- Sort: always `question_number ASC` (deterministic)

### 5.4 Answer key endpoint
Body: `{"answers":[{"questionId":"691121151","correctOptionId":"691121511"},{"questionId":"691121200","correctNumericValue":42.0}]}`
Rules: all `questionId`s must exist in the paper or the whole request fails with 422 (no partial updates). Sets `isAnswerKeyAvailable=true` on each, bumps `data_version`.

### 5.5 Caching and versioning
- Every paper has `data_version` (integer, incremented on any content change) and `content_hash` (SHA-256 of canonical JSON).
- JSON endpoints return `ETag: "<content_hash>"` and honor `If-None-Match` with `304`.
- **Asset filenames are content-addressed on ingest** (e.g. `q_691121151.png` stays logical, but the response ETag is the file's SHA-256), so assets can be `immutable`; replacing a paper changes ETags.

---

## 6. Database

### 6.1 Connection rules (in `db.py`, applied to every connection)
```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

### 6.2 Schema (`migrations/001_init.sql`)
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);

CREATE TABLE papers (
  id TEXT PRIMARY KEY CHECK (id GLOB '[a-z0-9-]*'),   -- slug, e.g. jee-main-2026-apr-s2
  title TEXT NOT NULL,
  exam TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  exam_metadata_json TEXT NOT NULL,          -- examMetadata block of the Universal JSON
  data_version INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sections (
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  section_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  question_type TEXT NOT NULL,
  marking_json TEXT NOT NULL,                -- {"correct":4,"wrong":-1,"unattempted":0}
  position INTEGER NOT NULL,
  PRIMARY KEY (paper_id, section_id)
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,                       -- "<paper_id>:<question_id>" (unique across papers)
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_id TEXT NOT NULL,                 -- NTA ID, string
  section_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single_choice','numeric')),
  content_json TEXT NOT NULL,
  options_json TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  explanation_json TEXT NOT NULL DEFAULT '{"text":"","imagePaths":[]}',
  source_json TEXT NOT NULL,
  UNIQUE (paper_id, question_number),
  UNIQUE (paper_id, question_id),
  FOREIGN KEY (paper_id, section_id) REFERENCES sections(paper_id, section_id)
);
CREATE INDEX idx_q_paper_subject ON questions(paper_id, subject);
CREATE INDEX idx_q_paper_section ON questions(paper_id, section_id);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,                       -- uuid4
  status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed')),
  paper_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

-- For future text search (after OCR/enrichment fills text). Empty for now, kept in sync by ingest.
CREATE VIRTUAL TABLE questions_fts USING fts5(
  question_id UNINDEXED, paper_id UNINDEXED, body, tokenize='unicode61'
);
```
Notes: IDs are TEXT everywhere. The question `id` is prefixed with `paper_id` because the same NTA question ID could in theory appear in two exports. Options stay as JSON inside `options_json` (they are always read with their question, never queried alone).

### 6.3 Safe asset path helper (`services/assets.py`)
```python
FILENAME_RE = re.compile(r"^(q|opt)_[0-9]+(_[0-9]+)?\.png$")
PAPER_RE    = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")

def resolve_asset(assets_dir: Path, paper_id: str, filename: str) -> Path:
    if not PAPER_RE.fullmatch(paper_id) or not FILENAME_RE.fullmatch(filename):
        raise NotFound()
    base = (assets_dir / paper_id).resolve()
    target = (base / filename).resolve()
    if base not in target.parents or not target.is_file():
        raise NotFound()
    return target
```
Always return 404 (never 400/403) so probing reveals nothing.

---

## 7. Ingestion

### 7.1 Seeder (`scripts/seed.py`)
- Input: a directory like `dist/qna/`; each subfolder containing `qna_database.json` and `images/` is one paper.
- Paper ID: from a `paperId` in `examMetadata` if present, else slug of `examName-year-session-shift` (lowercase, a-z0-9 and hyphens). Print the chosen ID.
- Per paper, **in one transaction**: validate JSON against the pipeline's Pydantic models, compute `content_hash`; if unchanged, skip ("unchanged"); else upsert paper, replace sections and questions, bump `data_version`; copy images to `ASSETS_DIR/{paper_id}/` (write to a temp dir, then swap) **only after** the DB transaction succeeds.
- Fail the paper (not the whole run) on validation errors and print the reason.
- Output summary: `inserted / updated / unchanged / failed`.
- Seeds whatever exists; it hardcodes **no** paper names.

### 7.2 Upload (`POST /admin/papers/upload`)
1. Check `X-Admin-Token`. Check `Content-Type` is `application/pdf` **and** the file starts with `%PDF-`. Reject over `MAX_UPLOAD_MB` (default 50) with 413.
2. Save to a temp job folder under `data/jobs/{job_id}/`, create a `jobs` row (`queued`), start a background task, return `202 {"jobId"}`.
3. Background task: run the pipeline (`extract`, then `validate`) in a **subprocess with a timeout** (default 10 min), then call the same ingest service as the seeder. On success set `done` plus `paperId`; on any failure set `failed` with a short error and delete the temp folder.
4. Only **one pipeline job runs at a time** (simple lock/queue), to protect CPU and memory.
5. Optional YAML config: accepted only as a *name* from the server's `configs/` directory (e.g. `jee_main`), **never an uploaded YAML file** (YAML upload is an injection surface).

### 7.3 CBT export (`services/cbt_export.py`)
- Builds the TestBench `PaperSchema` from DB rows. **Before coding, open an existing TestBench paper JSON and copy its exact field names**; add a test asserting the same top-level keys as that known-good file. Do not guess the schema.
- Image references in the output are **absolute-from-API-root paths** such as `/api/v1/assets/{paper_id}/q_691121151.png`; the frontend prefixes the base URL.
- Cache the derived JSON in memory keyed by `(paper_id, content_hash)`.

---

## 8. Frontend Integration

**Files:** `testbench/src/data/apiClient.ts`, `papers.ts`, `useAssetUrl.ts`.

- `VITE_API_URL` (default `http://localhost:8000/api/v1`).
- `apiClient`: `fetch` with a 5 s timeout; one retry on network error only (not on 4xx); typed errors from the envelope.
- **Read strategy for `getPaper(id)`:**
  1. Call the API with `If-None-Match` using the cached ETag.
  2. `200`: store the paper in Dexie (`id, etag, dataVersion, json, savedAt`); return it.
  3. `304`: return the cached copy.
  4. Network failure/timeout: return the cached copy if present and mark the UI "Offline (cached)"; if none, show an error with Retry.
  5. `404`: remove any stale cache for this id and show "Paper not found".
- **Images:** the browser's HTTP cache handles them (immutable + ETag). For offline exams, add an explicit **"Download for offline"** action that fetches all of a paper's images into Dexie/Cache Storage. Do not pretend images are offline unless this was done.
- **Health badge:** poll `/health` on load and every 30 s; states: `● Connected (v1)`, `● Offline (cached)`, `● Offline`.
- Mixed content: if the frontend is served over HTTPS, the API must be HTTPS too; document this.

---

## 9. Security Checklist

- [ ] Admin endpoints reject missing/wrong token (401); token compared with `secrets.compare_digest`.
- [ ] Startup **refuses to run** if `ADMIN_TOKEN` is unset or equals the example value, unless `ALLOW_INSECURE_DEV=1`.
- [ ] CORS origins from `CORS_ORIGINS` (comma-separated), no `*` together with credentials.
- [ ] Asset path traversal tests pass (section 6.3).
- [ ] Upload size/type/magic-byte checks; no user-supplied filenames used on disk.
- [ ] All SQL is parameterized (no f-string SQL).
- [ ] Pipeline runs with a timeout and cannot write outside its job folder.
- [ ] Basic rate limit on admin routes (simple in-memory limiter is fine).
- [ ] Logs never print the admin token.

---

## 10. Stages with Pass Criteria

### Stage 1: Foundation
**Do:** `settings.py`, `db.py` (PRAGMAs + migration runner), `001_init.sql`, `main.py` with CORS, error handlers, `GET /health`.
**Pass:** `pytest tests/test_health.py` passes; a fresh DB file gets all tables; `PRAGMA foreign_keys` returns 1 on a new connection.

### Stage 2: Ingest service + seeder
**Do:** `services/ingest.py`, `scripts/seed.py`, the mini fixture paper.
**Pass:** seeding the fixture twice gives `inserted` then `unchanged`; changing one question and re-seeding gives `updated` and `data_version == 2`; a corrupt JSON fixture gives `failed` and **no partial rows** in the DB.

### Stage 3: Read API
**Do:** `/papers`, `/papers/{id}`, `/download`, `/qna/{id}`, `/qna/{id}/questions`, `/assets/...`.
**Pass:** tests cover: catalog count, 404 envelope, pagination math (`pages = ceil(total/limit)`), each filter, ETag then `304`, `Content-Disposition` header, PNG content-type, and CBT JSON key parity with the known-good TestBench paper.

### Stage 4: Admin API
**Do:** token dependency, upload + job runner, answers PATCH, DELETE.
**Pass:** tests cover: 401 without token; 413 for oversize; 415 for a non-PDF renamed `.pdf`; upload of a small real PDF reaches `done` (pipeline mocked in unit tests, one real end-to-end test marked `@slow`); PATCH with one unknown `questionId` changes **nothing** (atomic); DELETE removes rows and the assets folder.

### Stage 5: Security tests
**Pass:** `test_assets_security.py` asserts 404 for: `../app.db`, `..%2Fapp.db`, `%2e%2e/%2e%2e/x`, absolute paths, filenames not matching the regex, a symlink inside the assets dir pointing outside, and `paper_id` with slashes.

### Stage 6: Frontend wiring
**Do:** section 8.
**Pass (manual, written to `docs/FRONTEND_CHECK.md`):** (a) online load works; (b) stop the backend, reload, and the cached paper still opens with the "Offline (cached)" badge; (c) a never-loaded paper shows a clear error; (d) after "Download for offline", the images show with the backend off.

### Stage 7: Docs and ops
- `README`: setup, env vars, run command (`uvicorn backend.app.main:app --host 0.0.0.0 --port 8000`), seeding, upload example with `curl`, and backup (copy `app.db`, `app.db-wal`, and `assets/`, or use `sqlite3 .backup`).
- Optional: `Dockerfile` and `docker-compose.yml` mounting `backend/data`.

---

## 11. Guidance for the Implementing LLM

- One stage at a time; run its pass checks before continuing. If a check fails, **fix the cause, never loosen the test**.
- Do not invent the TestBench schema or pipeline model fields; open the real files and copy.
- Keep routes thin; if a route function is over about 30 lines, move logic to `services/`.
- Commit after each passing stage.
- Record anything you could not finish in `KNOWN_ISSUES.md` with the file and endpoint.

## 12. Upgrade Path (for a stronger LLM later)

- Fill `content.text` via the pipeline's Enrich stage, then populate `questions_fts` and make `search` use FTS5 with ranking.
- Add user accounts, attempt storage, and analytics as new tables (do not change existing ones).
- Move to PostgreSQL + object storage (S3-compatible) behind the same `repositories/` and `services/assets.py` interfaces.
- Generate an OpenAPI-based TypeScript client for the frontend instead of hand-written types.

## 13. Open Decisions

1. **Auth model:** is a single shared admin token enough, or do you need named admin users?
2. **Public vs private data:** may the API be exposed publicly, or only on LAN/localhost? (Affects CORS, rate limits, and whether PDFs/images have licensing constraints.)
3. **Offline requirement:** is "download for offline" needed for exams, or is a cached JSON plus normal HTTP image caching enough?
4. **Answer keys:** will keys come from the pipeline, a separate NTA key file, or manual PATCH?