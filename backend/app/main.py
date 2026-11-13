"""FastAPI application factory for the versioned standalone API."""

import sqlite3
from contextlib import asynccontextmanager
from typing import Any
from starlette.exceptions import HTTPException as StarletteHTTPException

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.db import migrate
from backend.app.settings import Settings, get_settings
from backend.app.routes import assets, papers, qna, admin, exams, meta


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    """Build the common API error envelope."""
    return {"error": {"code": code, "message": message, "details": details}}


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create an API app, optionally with isolated test settings."""
    config = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        # Explicit Settings injection is used by tests/embedded deployments; the
        # standalone process must never start with an unprotected admin API.
        if settings is None and (not config.admin_token or config.admin_token == "replace-with-a-long-random-secret") and not config.allow_insecure_dev:
            raise RuntimeError("Set a non-example ADMIN_TOKEN or explicitly enable ALLOW_INSECURE_DEV=1")
        migrate(config)
        yield

    app = FastAPI(title="Question & Mock Exam API", version="1", lifespan=lifespan)
    app.state.settings = config
    app.include_router(meta.router, prefix="/api/v1")
    app.include_router(exams.router, prefix="/api/v1")
    app.include_router(papers.router, prefix="/api/v1")
    app.include_router(qna.router, prefix="/api/v1")
    app.include_router(assets.router, prefix="/api/v1")
    app.include_router(admin.router, prefix="/api/v1")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "If-None-Match", "X-Admin-Token", "X-Client", "X-Features", "X-Schema-Max", "Range"],
        expose_headers=["ETag", "X-Data-Version", "Content-Disposition", "Content-Range", "Accept-Ranges"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"loc": err.get("loc"), "msg": err.get("msg"), "type": err.get("type")} for err in exc.errors()]
        return JSONResponse(status_code=422, content=error_body("validation_error", "Request validation failed", details))

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        codes = {401: "unauthorized", 404: "not_found", 409: "conflict", 413: "payload_too_large", 415: "unsupported_media_type", 422: "validation_error"}
        return JSONResponse(status_code=exc.status_code, headers=exc.headers,
                            content=error_body(codes.get(exc.status_code, "internal_error"), str(exc.detail)))

    @app.exception_handler(sqlite3.Error)
    async def database_error(_: Request, __: sqlite3.Error) -> JSONResponse:
        return JSONResponse(status_code=500, content=error_body("internal_error", "An internal error occurred"))

    @app.exception_handler(Exception)
    async def unexpected_error(_: Request, __: Exception) -> JSONResponse:
        return JSONResponse(status_code=500, content=error_body("internal_error", "An internal error occurred"))

    @app.get("/api/v1/health")
    def health() -> dict[str, Any]:
        try:
            with sqlite3.connect(config.db_path) as connection:
                connection.execute("SELECT 1")
            return {"status": "ok", "apiVersion": "v1", "dbOk": True}
        except sqlite3.Error:
            return JSONResponse(status_code=503, content={"status": "error", "apiVersion": "v1", "dbOk": False})

    return app


app = create_app()
