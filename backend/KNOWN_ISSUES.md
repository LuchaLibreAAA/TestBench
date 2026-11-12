# Backend follow-up

- `backend/app/services/jobs.py`: pipeline execution has a subprocess timeout and a single-process async lock, but it is not OS sandboxed. Treat uploaded PDFs as untrusted and keep this API on a trusted network until subprocess filesystem isolation is added.
- `backend/app/security.py`: admin authentication is enforced, but the architecture's basic per-client rate limit is not implemented yet.
- Admin route coverage is currently a manual smoke check; committed tests cover health and ingest, but not the complete stage 3–5 contract.
- The architecture's frontend offline-cache wiring (stage 6) is outside the backend implementation and remains to be done in `testbench/`.
