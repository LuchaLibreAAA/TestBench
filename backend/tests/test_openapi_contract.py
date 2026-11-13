"""Ensure no breaking changes to the committed OpenAPI v1 specification."""

import json
from pathlib import Path
from backend.app.main import create_app
from backend.app.settings import Settings


def test_openapi_no_breaking_removals():
    snapshot_path = Path("backend/openapi.v1.json")
    assert snapshot_path.exists(), "backend/openapi.v1.json must be committed"

    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    app = create_app(Settings(admin_token="test", allow_insecure_dev=True))
    current = app.openapi()

    # Rule 1: No paths may be removed under /api/v1
    snap_paths = set(snapshot.get("paths", {}).keys())
    curr_paths = set(current.get("paths", {}).keys())
    missing_paths = snap_paths - curr_paths
    assert not missing_paths, f"Breaking change: Removed API paths: {missing_paths}"

    # Rule 2: For existing paths, no HTTP methods may be removed
    for path, snap_methods in snapshot.get("paths", {}).items():
        curr_methods = current["paths"][path]
        missing_methods = set(snap_methods.keys()) - set(curr_methods.keys())
        assert not missing_methods, f"Breaking change on {path}: Removed methods {missing_methods}"
