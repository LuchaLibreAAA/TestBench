"""Storage abstraction package for local disk and S3/R2 backends."""

from typing import Optional

from backend.app.storage.base import StorageBackend
from backend.app.storage.local import LocalStorage
from backend.app.storage.s3 import S3Storage
from backend.app.settings import Settings, get_settings


def get_storage(settings: Optional[Settings] = None) -> StorageBackend:
    """Return configured singleton or instance StorageBackend."""
    config = settings or get_settings()
    if config.storage_backend == "s3":
        return S3Storage(
            bucket=config.s3_bucket,
            endpoint_url=config.s3_endpoint_url,
            access_key=config.s3_access_key,
            secret_key=config.s3_secret_key,
            region=config.s3_region,
            public_url_prefix=config.s3_public_url_prefix,
        )
    return LocalStorage(
        base_dir=config.assets_dir,
        public_url_prefix=config.storage_public_url_prefix,
    )


__all__ = ["StorageBackend", "LocalStorage", "S3Storage", "get_storage"]
