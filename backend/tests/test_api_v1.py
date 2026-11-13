"""Comprehensive tests for API v1: meta, exams, capability negotiation, packages, and admin."""

import io
import json
import zipfile
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app.settings import Settings
from backend.app.services.ingest import ingest_file
from backend.tests.test_ingest import setup_paper, PNG_1X1


@pytest.fixture
def client_with_data(tmp_path: Path):
    source = setup_paper(tmp_path)
    settings = Settings(
        db_path=tmp_path / "api.db",
        assets_dir=tmp_path / "assets",
        admin_token="secret-token",
        allow_insecure_dev=True,
        cors_origins=[],
    )
    app = create_app(settings)
    with TestClient(app) as client:
        # Ingest one paper
        res = ingest_file(source / "qna_database.json", settings)
        assert res.status == "inserted"
        yield client, settings, res.paper_id


def test_meta_endpoint(client_with_data):
    client, _, _ = client_with_data
    resp = client.get("/api/v1/meta")
    assert resp.status_code == 200
    data = resp.json()
    assert data["apiVersion"] == "v1"
    assert "single_choice" in data["features"]
    assert "web" in data["minSupportedClient"]
    assert "serverTime" in data


def test_exams_endpoints(client_with_data):
    client, _, _ = client_with_data
    # 1. List exams
    resp = client.get("/api/v1/exams")
    assert resp.status_code == 200
    exams = resp.json()
    assert len(exams) >= 3
    codes = [e["code"] for e in exams]
    assert "jee-main" in codes

    # 2. Get specific exam
    resp = client.get("/api/v1/exams/jee-main")
    assert resp.status_code == 200
    assert resp.json()["code"] == "jee-main"


def test_papers_capability_negotiation(client_with_data):
    client, _, paper_id = client_with_data

    # Standard get
    resp = client.get("/api/v1/papers")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(p["id"] == paper_id for p in items)

    # Filter with schema max = 0 (should exclude schemaVersion=1)
    resp = client.get("/api/v1/papers", headers={"X-Schema-Max": "0"})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 0

    # Filter with schema max = 1
    resp = client.get("/api/v1/papers", headers={"X-Schema-Max": "1"})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) > 0


def test_manifest_and_bundle(client_with_data):
    client, _, paper_id = client_with_data

    # Manifest
    resp = client.get(f"/api/v1/papers/{paper_id}/manifest")
    assert resp.status_code == 200
    manifest = resp.json()
    assert manifest["paperId"] == paper_id
    assert manifest["dataVersion"] >= 1
    assert len(manifest["assets"]) == 2  # q_101.png, opt_101_1.png

    # ETag check
    etag = resp.headers.get("ETag")
    assert etag is not None
    resp_304 = client.get(f"/api/v1/papers/{paper_id}/manifest", headers={"If-None-Match": etag})
    assert resp_304.status_code == 304

    # Bundle
    resp_b = client.get(f"/api/v1/papers/{paper_id}/bundle")
    assert resp_b.status_code == 200
    bundle = resp_b.json()
    assert "paper" in bundle
    assert "manifest" in bundle


def test_package_and_range(client_with_data):
    client, _, paper_id = client_with_data

    resp = client.get(f"/api/v1/papers/{paper_id}/package?w=720")
    assert resp.status_code == 200
    assert resp.headers["Content-Type"] == "application/zip"
    total_len = len(resp.content)
    assert total_len > 0

    # Verify zip content
    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    names = zf.namelist()
    assert "paper.json" in names
    assert "manifest.json" in names

    # HTTP Range test (resumable downloads)
    range_resp = client.get(
        f"/api/v1/papers/{paper_id}/package?w=720",
        headers={"Range": "bytes=0-49"},
    )
    assert range_resp.status_code == 206
    assert len(range_resp.content) == 50
    assert range_resp.content == resp.content[:50]


def test_admin_asset_replace(client_with_data):
    client, _, paper_id = client_with_data

    headers = {"X-Admin-Token": "secret-token"}
    new_png = PNG_1X1  # Valid PNG bytes

    resp = client.put(
        f"/api/v1/admin/papers/{paper_id}/assets/q_101.png",
        files={"asset_file": ("q_101.png", new_png, "image/png")},
        headers=headers,
    )
    assert resp.status_code == 200
    res = resp.json()
    assert res["paperId"] == paper_id
    assert res["dataVersion"] == 2
