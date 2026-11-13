# Backend API (`v0.0.3`)

FastAPI service acting as the authoritative single source of truth for all question papers, answer keys, assets, and question banks.

## Quickstart

From the repository root:

1. Install dependencies:
   ```powershell
   pip install -r backend/requirements.txt
   ```
2. Set environment variables (or copy from `.env.example`):
   ```powershell
   $env:ADMIN_TOKEN = "your-secure-admin-token"
   $env:STORAGE_BACKEND = "local" # or "s3"
   ```
3. Run migrations and seed data:
   ```powershell
   python scripts/seed_all_papers.py
   ```
4. Start the server:
   ```powershell
   uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Storage Backends

Configured via `STORAGE_BACKEND`:

- **`local` (default):** Assets and packages are stored in `backend/data/assets/` with strict path-traversal guards.
- **`s3`:** Stores assets in S3 / Cloudflare R2:
  ```env
  STORAGE_BACKEND=s3
  S3_BUCKET=testbench-assets
  S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
  S3_ACCESS_KEY_ID=<key>
  S3_SECRET_ACCESS_KEY=<secret>
  ```

## Public API (`/api/v1`)

- `GET /meta`: Server version, active schema limits, and client capabilities.
- `GET /exams`: Registry of supported exams and layout specs.
- `GET /papers`: Paginated catalog with client capability filtering (`X-Features`, `X-Schema-Max`).
- `GET /papers/{id}`: Dynamic CBT paper JSON with ETag caching.
- `GET /papers/{id}/manifest`: Complete asset manifest with SHA-256 hashes and sizes.
- `GET /papers/{id}/bundle`: Combined paper JSON + asset manifest in a single call.
- `GET /papers/{id}/package`: Pre-packaged offline `.zip` bundle with HTTP 206 `Range` support.
- `GET /assets/{paperId}/{filename}`: Content-addressed image delivery with WebP variant generation (`?w=480|720|1080`).
- `GET /qna/{id}`: Universal Q&A JSON export.
- `GET /qna/{id}/questions`: Filtered, paginated question search with SQLite FTS5.

## Admin API (`/api/v1/admin`)

Requires `X-Admin-Token` header:

- `POST /admin/papers/ingest`: Upload `.zip` package containing `qna_database.json` and `images/`.
- `PUT /admin/papers/{id}/assets/{filename}`: Hot-replace an asset image and regenerate variants.
- `POST /admin/exams`: Register a new exam specification.
- `PATCH /admin/papers/{id}`: Update paper metadata.
- `PATCH /admin/papers/{id}/answers`: Patch official answer keys.
- `DELETE /admin/papers/{id}`: Cascade delete paper, sections, questions, and asset files.

## Tests

Run the test suite:

```powershell
python -m pytest backend/tests
```
