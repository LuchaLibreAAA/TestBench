"""Environment based configuration for the standalone API."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Service settings loaded from environment and optional backend/.env."""

    model_config = SettingsConfigDict(env_file="backend/.env", env_file_encoding="utf-8", extra="ignore")

    db_path: Path = Path("backend/data/app.db")
    assets_dir: Path = Path("backend/data/assets")
    storage_backend: str = "local"
    storage_public_url_prefix: str | None = None
    s3_bucket: str = ""
    s3_endpoint_url: str | None = None
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_region: str = "auto"
    s3_public_url_prefix: str | None = None
    admin_token: str = ""
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    max_upload_mb: int = 50
    allow_insecure_dev: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                value = json.loads(stripped)
            else:
                value = [origin.strip() for origin in stripped.split(",") if origin.strip()]
        if isinstance(value, list) and "*" in value:
            raise ValueError("CORS_ORIGINS cannot contain '*' when credentials are enabled")
        return value

    @field_validator("max_upload_mb")
    @classmethod
    def positive_upload_limit(cls, value: int) -> int:
        if value < 1:
            raise ValueError("MAX_UPLOAD_MB must be positive")
        return value


@lru_cache
def get_settings() -> Settings:
    """Return cached process settings."""
    return Settings()
