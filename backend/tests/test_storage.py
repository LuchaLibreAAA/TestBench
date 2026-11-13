"""Tests for StorageBackend implementations."""

import pytest
from pathlib import Path
from backend.app.storage.base import StorageBackend
from backend.app.storage.local import LocalStorage


def test_local_storage_lifecycle(tmp_path: Path):
    storage: StorageBackend = LocalStorage(tmp_path / "assets", public_url_prefix="https://cdn.example.com/assets")

    key = "ab/sample.png"
    data = b"\x89PNG\r\n\x1a\nfakeimagebytes"

    assert not storage.exists(key)
    storage.put(key, data, "image/png")
    assert storage.exists(key)

    chunks = list(storage.open(key))
    assert b"".join(chunks) == data

    assert storage.public_url(key) == "https://cdn.example.com/assets/ab/sample.png"

    storage.delete(key)
    assert not storage.exists(key)


def test_local_storage_path_traversal(tmp_path: Path):
    storage = LocalStorage(tmp_path / "assets")

    with pytest.raises(ValueError, match="Path traversal"):
        storage.put("../outside.txt", b"bad", "text/plain")

    with pytest.raises(ValueError, match="Path traversal"):
        list(storage.open("../../etc/passwd"))
