"""API routes for test papers in TestBench CBT format with capability negotiation and packages."""

import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

from backend.app.db import get_db
from backend.app.models.api_models import CatalogResponse, PaperManifestResponse, PaperSummary
from backend.app.repositories.paper_repo import PaperRepository
from backend.app.storage import get_storage

router = APIRouter(prefix="/papers", tags=["Papers"])


@router.get("", response_model=CatalogResponse)
def get_papers_catalog(
    request: Request,
    exam: Optional[str] = Query(None, description="Filter by exam code"),
    year: Optional[int] = Query(None, description="Filter by exam year"),
    q: Optional[str] = Query(None, description="Search query"),
    x_client: Optional[str] = Header(None),
    x_features: Optional[str] = Header(None),
    x_schema_max: Optional[int] = Header(None),
):
    """List available test papers with capability negotiation."""
    settings = request.app.state.settings
    client_features = set()
    if x_features:
        try:
            if x_features.strip().startswith("["):
                client_features = set(json.loads(x_features))
            else:
                client_features = {f.strip() for f in x_features.split(",") if f.strip()}
        except Exception:
            client_features = set()

    with get_db(settings) as conn:
        query = """
            SELECT p.id, p.title, p.exam, p.exam_code, p.year, p.duration_min, p.total_questions,
                   p.status, p.schema_version, p.min_client_version, p.required_features,
                   (SELECT COUNT(*) FROM sections s WHERE s.paper_id=p.id) AS sections_count
            FROM papers p
            WHERE p.status = 'published'
        """
        params: List[Any] = []
        if exam:
            query += " AND (p.exam_code = ? OR p.exam = ?)"
            params.extend([exam, exam])
        if year:
            query += " AND p.year = ?"
            params.append(year)
        if q:
            query += " AND (p.title LIKE ? OR p.id LIKE ?)"
            term = f"%{q}%"
            params.extend([term, term])

        query += " ORDER BY p.year DESC, p.id ASC"
        rows = conn.execute(query, params).fetchall()

        if not rows and not exam and not year and not q:
            # Immediate fallback to seeds/papers/catalog.json if database is still seeding in background
            from pathlib import Path
            seed_catalog = Path(__file__).resolve().parent.parent.parent / "seeds" / "papers" / "catalog.json"
            if seed_catalog.is_file():
                try:
                    cat_items = json.loads(seed_catalog.read_text(encoding="utf-8"))
                    fallback_summaries = []
                    for item in cat_items:
                        fallback_summaries.append(
                            PaperSummary(
                                id=item["id"],
                                title=item["title"],
                                exam=item["exam"],
                                examCode=item.get("exam"),
                                year=item["year"],
                                durationMin=item.get("durationMin", 180),
                                totalQuestions=item.get("questionsCount", 0),
                                sectionsCount=item.get("sectionsCount", 0),
                                badge=item.get("badge", ""),
                                status="published",
                                minClientVersion=1,
                                requiredFeatures=[],
                            )
                        )
                    return {"items": fallback_summaries}
                except Exception:
                    pass

        items = []
        for r in rows:
            req_features = []
            if r["required_features"]:
                try:
                    req_features = json.loads(r["required_features"])
                except Exception:
                    pass

            # Capability negotiation: if client provided features, ensure it supports all required
            if client_features and req_features:
                if not set(req_features).issubset(client_features):
                    continue

            # Schema version check
            if x_schema_max is not None:
                try:
                    schema_v = int(float(r["schema_version"]))
                    if schema_v > x_schema_max:
                        continue
                except Exception:
                    pass

            items.append(
                PaperSummary(
                    id=r["id"],
                    title=r["title"],
                    exam=r["exam"],
                    examCode=r["exam_code"],
                    year=r["year"],
                    durationMin=r["duration_min"],
                    totalQuestions=r["total_questions"],
                    sectionsCount=r["sections_count"],
                    badge=f"{r['exam'].upper()} {r['year']}",
                    status=r["status"],
                    minClientVersion=r["min_client_version"],
                    requiredFeatures=req_features,
                )
            )

        return {"items": items}


@router.get("/{paper_id}/manifest", response_model=PaperManifestResponse)
def get_paper_manifest(
    paper_id: str,
    request: Request,
    response: Response,
    if_none_match: Optional[str] = Header(None),
):
    """Retrieve the asset manifest for a paper to enable offline prefetch."""
    settings = request.app.state.settings
    with get_db(settings) as conn:
        paper = conn.execute("SELECT content_hash, data_version FROM papers WHERE id=?", (paper_id,)).fetchone()
        if not paper:
            raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found")

        etag = f'"{paper["content_hash"]}"'
        if if_none_match == etag:
            return Response(status_code=304, headers={"ETag": etag})

        response.headers["ETag"] = etag
        response.headers["X-Data-Version"] = str(paper["data_version"])

        assets = conn.execute(
            "SELECT filename, sha256, bytes, role FROM assets WHERE paper_id=? ORDER BY filename ASC",
            (paper_id,),
        ).fetchall()

        manifest_assets = [
            {
                "filename": a["filename"],
                "sha256": a["sha256"],
                "bytes": a["bytes"],
                "role": a["role"],
                "url": f"/api/v1/assets/{paper_id}/{a['filename']}?v={a['sha256'][:8]}",
            }
            for a in assets
        ]

        return PaperManifestResponse(
            paperId=paper_id,
            dataVersion=paper["data_version"],
            contentHash=paper["content_hash"],
            assets=manifest_assets,
        )


@router.get("/{paper_id}/package")
def get_paper_package(
    paper_id: str,
    request: Request,
    w: int = Query(720, description="Image variant width for the package"),
    if_none_match: Optional[str] = Header(None),
    range_header: Optional[str] = Header(None, alias="Range"),
):
    """Download a pre-packaged offline zip bundle with Range and ETag support."""
    settings = request.app.state.settings
    storage = get_storage(settings)
    variant_name = f"w{w}" if w in (480, 720, 1080) else "w720"

    with get_db(settings) as conn:
        pkg = conn.execute(
            "SELECT storage_key, sha256, bytes, data_version FROM paper_packages WHERE paper_id=? AND variant=?",
            (paper_id, variant_name),
        ).fetchone()

        if not pkg:
            # Fallback to any package for this paper
            pkg = conn.execute(
                "SELECT storage_key, sha256, bytes, data_version FROM paper_packages WHERE paper_id=? LIMIT 1",
                (paper_id,),
            ).fetchone()

        if not pkg or not storage.exists(pkg["storage_key"]):
            raise HTTPException(status_code=404, detail=f"Offline package for paper '{paper_id}' not found")

    etag = f'"{pkg["sha256"]}"'
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})

    total_bytes = pkg["bytes"]

    # Handle HTTP Range header for resumable downloads
    if range_header and range_header.startswith("bytes="):
        byte_range = range_header[6:].strip()
        parts = byte_range.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else total_bytes - 1
        end = min(end, total_bytes - 1)
        length = end - start + 1

        all_bytes = b"".join(storage.open(pkg["storage_key"]))
        sliced = all_bytes[start : end + 1]

        headers = {
            "Content-Range": f"bytes {start}-{end}/{total_bytes}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": "application/zip",
            "ETag": etag,
            "X-Data-Version": str(pkg["data_version"]),
        }
        return Response(content=sliced, status_code=206, headers=headers)

    headers = {
        "Content-Length": str(total_bytes),
        "Content-Type": "application/zip",
        "Accept-Ranges": "bytes",
        "ETag": etag,
        "X-Data-Version": str(pkg["data_version"]),
        "Content-Disposition": f'attachment; filename="{paper_id}-package.zip"',
    }

    return StreamingResponse(storage.open(pkg["storage_key"]), media_type="application/zip", headers=headers)


@router.get("/{paper_id}/bundle")
def get_paper_bundle(
    paper_id: str,
    request: Request,
    response: Response,
    if_none_match: Optional[str] = Header(None),
):
    """Return paper JSON and manifest in a single call to minimize roundtrips."""
    settings = request.app.state.settings
    paper = PaperRepository.get_paper(paper_id, settings)
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found")

    content_hash, version = PaperRepository.paper_version(paper_id, settings)
    etag = f'"{content_hash}"'
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})

    response.headers["ETag"] = etag
    response.headers["X-Data-Version"] = str(version)

    with get_db(settings) as conn:
        assets = conn.execute(
            "SELECT filename, sha256, bytes, role FROM assets WHERE paper_id=? ORDER BY filename ASC",
            (paper_id,),
        ).fetchall()

    manifest = {
        "paperId": paper_id,
        "dataVersion": version,
        "contentHash": content_hash,
        "assets": [
            {
                "filename": a["filename"],
                "sha256": a["sha256"],
                "bytes": a["bytes"],
                "role": a["role"],
                "url": f"/api/v1/assets/{paper_id}/{a['filename']}?v={a['sha256'][:8]}",
            }
            for a in assets
        ],
    }

    return {"paper": paper, "manifest": manifest}


@router.get("/{paper_id}", response_model=Dict[str, Any])
def get_paper_by_id(paper_id: str, request: Request, response: Response, if_none_match: Optional[str] = Header(None)):
    """Retrieve full CBT paper structure in TestBench JSON format."""
    paper = PaperRepository.get_paper(paper_id, request.app.state.settings)
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found")
    content_hash, version = PaperRepository.paper_version(paper_id, request.app.state.settings)
    etag = f'"{content_hash}"'
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})
    response.headers["ETag"] = etag
    response.headers["X-Data-Version"] = str(version)
    return paper


@router.get("/{paper_id}/download")
def download_paper_json(paper_id: str, request: Request, if_none_match: Optional[str] = Header(None)):
    """Download the paper as a JSON file."""
    paper = PaperRepository.get_paper(paper_id, request.app.state.settings)
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found")

    content_hash, version = PaperRepository.paper_version(paper_id, request.app.state.settings)
    etag = f'"{content_hash}"'
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})
    content = json.dumps(paper, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{paper_id}.json"',
            "ETag": etag,
            "X-Data-Version": str(version),
        },
    )
