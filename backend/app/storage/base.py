"""StorageBackend protocol for abstracting asset and bundle persistence."""

from typing import Iterator, Protocol, runtime_checkable


@runtime_checkable
class StorageBackend(Protocol):
    """Protocol for abstracting object storage (local disk or S3/R2)."""

    def put(self, key: str, data: bytes, content_type: str) -> None:
        """Store bytes at key with given content type."""
        ...

    def open(self, key: str) -> Iterator[bytes]:
        """Stream bytes chunk-by-chunk for key."""
        ...

    def exists(self, key: str) -> bool:
        """Check if key exists in storage."""
        ...

    def delete(self, key: str) -> None:
        """Delete key from storage if present."""
        ...

    def public_url(self, key: str) -> str | None:
        """Return public direct/CDN URL if configured, otherwise None to stream through API."""
        ...
