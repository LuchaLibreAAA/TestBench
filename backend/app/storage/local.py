"""Local filesystem implementation of StorageBackend with path-traversal safeguards."""

import os
from pathlib import Path
from typing import Iterator

CHUNK_SIZE = 64 * 1024  # 64 KB


class LocalStorage:
    """Stores assets on local disk with containment checks."""

    def __init__(self, base_dir: Path | str, public_url_prefix: str | None = None) -> None:
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.public_url_prefix = public_url_prefix.rstrip("/") if public_url_prefix else None

    def _resolve(self, key: str) -> Path:
        normalized = key.replace("\\", "/").lstrip("/")
        # Prevent path traversal
        resolved = (self.base_dir / normalized).resolve()
        try:
            resolved.relative_to(self.base_dir)
        except ValueError:
            raise ValueError(f"Path traversal detected: {key}")
        return resolved

    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Write atomically via temp file
        temp_path = path.with_suffix(f"{path.suffix}.tmp.{os.getpid()}")
        temp_path.write_bytes(data)
        temp_path.replace(path)

    def open(self, key: str) -> Iterator[bytes]:
        path = self._resolve(key)
        if not path.is_file():
            raise FileNotFoundError(f"Key not found: {key}")
        with path.open("rb") as f:
            while chunk := f.read(CHUNK_SIZE):
                yield chunk

    def exists(self, key: str) -> bool:
        try:
            path = self._resolve(key)
            return path.is_file()
        except ValueError:
            return False

    def delete(self, key: str) -> None:
        try:
            path = self._resolve(key)
            if path.is_file():
                path.unlink()
        except (ValueError, FileNotFoundError):
            pass

    def public_url(self, key: str) -> str | None:
        if self.public_url_prefix:
            normalized = key.replace("\\", "/").lstrip("/")
            return f"{self.public_url_prefix}/{normalized}"
        return None
