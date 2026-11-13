"""Validate and ingest Universal Q&A files into the canonical SQLite store with content-addressed assets."""

import hashlib
import io
import json
import re
import sqlite3
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image
from pydantic import ValidationError

from backend.app.db import get_db
from backend.app.repositories.ingest_repo import replace_paper
from backend.app.services.cbt_export import export_paper
from backend.app.settings import Settings, get_settings
from backend.app.storage import get_storage
from backend.app.storage.base import StorageBackend
from tools.pdf_qna_pipeline.models import QnADatabase

PAPER_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")
FILENAME_RE = re.compile(r"^(q|opt|exp|asset)_[a-zA-Z0-9_.-]+\.(png|webp|jpg|jpeg)$")
MAX_ASSET_BYTES = 5 * 1024 * 1024  # 5 MB
VARIANT_WIDTHS = [480, 720, 1080]


@dataclass
class IngestResult:
    """Outcome for one attempted paper ingestion."""

    paper_id: str | None
    status: str
    reason: str | None = None
    data_version: int = 1


def paper_id_for(raw: dict, source: Path | str | None = None) -> str:
    """Choose the declared paper ID or derive a stable kebab-case ID."""
    metadata = raw.get("examMetadata", {})
    declared = metadata.get("paperId") or raw.get("id")
    if declared:
        cleaned = re.sub(r"[^a-z0-9]+", "-", str(declared).lower()).strip("-")
        if PAPER_RE.fullmatch(cleaned):
            return cleaned

    name = "-".join(
        str(part)
        for part in (
            metadata.get("examName", "exam"),
            metadata.get("year", ""),
            metadata.get("session", ""),
            metadata.get("shift", ""),
        )
        if part
    ).lower()
    paper_id = re.sub(r"[^a-z0-9]+", "-", name).strip("-")
    if not PAPER_RE.fullmatch(paper_id):
        raise ValueError("Derived paper ID is invalid")
    return paper_id


def _determine_role(filename: str) -> str:
    lower = filename.lower()
    if lower.startswith("q_"):
        return "question"
    if lower.startswith("opt_"):
        return "option"
    if lower.startswith("exp_"):
        return "explanation"
    return "other"


def _extract_question_id(filename: str) -> Optional[str]:
    match = re.search(r"(?:q|opt|exp)_([a-zA-Z0-9_-]+?)(?:[-_]opt\d+)?\.(?:png|webp|jpg|jpeg)$", filename, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def process_image_bytes(
    storage: StorageBackend,
    paper_id: str,
    filename: str,
    data: bytes,
    local_mirror_dir: Optional[Path] = None,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Validate image, store content-addressed original and WebP variants."""
    if len(data) > MAX_ASSET_BYTES:
        raise ValueError(f"Asset '{filename}' exceeds {MAX_ASSET_BYTES // (1024 * 1024)}MB limit")

    try:
        img = Image.open(io.BytesIO(data))
        orig_width, orig_height = img.size
        # Normalize image to RGB/RGBA if palette
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
    except Exception as exc:
        raise ValueError(f"Invalid image format for '{filename}': {exc}")

    # 1. Store original PNG
    digest = hashlib.sha256(data).hexdigest()
    storage_key = f"{digest[:2]}/{digest}.png"
    if not storage.exists(storage_key):
        storage.put(storage_key, data, "image/png")

    # Mirror locally if requested for backwards compatibility
    if local_mirror_dir:
        dest = local_mirror_dir / paper_id / filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            dest.write_bytes(data)

    role = _determine_role(filename)
    qid = _extract_question_id(filename)

    asset_row = {
        "paper_id": paper_id,
        "filename": filename,
        "sha256": digest,
        "storage_key": storage_key,
        "bytes": len(data),
        "width": orig_width,
        "height": orig_height,
        "role": role,
        "question_id": qid,
    }

    # 2. Generate variants
    variants = []
    for target_w in VARIANT_WIDTHS:
        if orig_width > target_w:
            new_h = max(1, int(orig_height * (target_w / orig_width)))
            resized = img.resize((target_w, new_h), Image.Resampling.LANCZOS)
        else:
            resized = img

        buf = io.BytesIO()
        resized.save(buf, format="WEBP", quality=85)
        var_data = buf.getvalue()
        var_digest = hashlib.sha256(var_data).hexdigest()
        var_key = f"{var_digest[:2]}/{var_digest}_w{target_w}.webp"
        if not storage.exists(var_key):
            storage.put(var_key, var_data, "image/webp")

        variants.append(
            {
                "paper_id": paper_id,
                "filename": filename,
                "variant": f"w{target_w}",
                "format": "webp",
                "sha256": var_digest,
                "storage_key": var_key,
                "bytes": len(var_data),
            }
        )

    return asset_row, variants


def build_paper_package(
    connection: sqlite3.Connection,
    storage: StorageBackend,
    paper_id: str,
    data_version: int,
    variant_name: str = "w720",
    settings: Settings | None = None,
) -> Dict[str, Any]:
    """Build and store an offline zip package (paper JSON + manifest + images)."""
    paper = connection.execute("SELECT * FROM papers WHERE id=?", (paper_id,)).fetchone()
    if not paper:
        raise ValueError(f"Paper {paper_id} not found to build package")

    sections = connection.execute("SELECT * FROM sections WHERE paper_id=? ORDER BY position", (paper_id,)).fetchall()
    questions = connection.execute("SELECT * FROM questions WHERE paper_id=? ORDER BY question_number", (paper_id,)).fetchall()
    paper_json = export_paper(paper_id, paper, sections, questions)

    cursor = connection.cursor()
    cursor.execute(
        """SELECT a.filename, a.sha256, a.storage_key, a.bytes, a.role,
                  v.storage_key AS var_key, v.bytes AS var_bytes, v.sha256 AS var_sha
           FROM assets a
           LEFT JOIN asset_variants v ON a.paper_id = v.paper_id AND a.filename = v.filename AND v.variant = ?
           WHERE a.paper_id = ?""",
        (variant_name, paper_id),
    )
    asset_rows = cursor.fetchall()

    manifest_assets = []
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. Write paper.json
        zf.writestr("paper.json", json.dumps(paper_json, indent=2))

        # 2. Write images
        for row in asset_rows:
            key_to_use = row["var_key"] or row["storage_key"]
            bytes_to_use = row["var_bytes"] or row["bytes"]
            sha_to_use = row["var_sha"] or row["sha256"]

            manifest_assets.append(
                {
                    "filename": row["filename"],
                    "sha256": sha_to_use,
                    "bytes": bytes_to_use,
                    "role": row["role"],
                    "url": f"/api/v1/assets/{paper_id}/{row['filename']}?v={sha_to_use[:8]}",
                }
            )

            if storage.exists(key_to_use):
                img_data = b"".join(storage.open(key_to_use))
                zf.writestr(f"images/{row['filename']}", img_data)

        # 3. Write manifest.json
        manifest = {
            "paperId": paper_id,
            "dataVersion": data_version,
            "variant": variant_name,
            "assets": manifest_assets,
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

    package_data = zip_buffer.getvalue()
    pkg_digest = hashlib.sha256(package_data).hexdigest()
    pkg_key = f"packages/{paper_id}_{variant_name}_v{data_version}_{pkg_digest[:8]}.zip"
    if not storage.exists(pkg_key):
        storage.put(pkg_key, package_data, "application/zip")

    cursor.execute(
        """INSERT INTO paper_packages(paper_id, variant, data_version, storage_key, sha256, bytes)
           VALUES(?, ?, ?, ?, ?, ?)
           ON CONFLICT(paper_id, variant) DO UPDATE SET
           data_version=excluded.data_version, storage_key=excluded.storage_key,
           sha256=excluded.sha256, bytes=excluded.bytes""",
        (paper_id, variant_name, data_version, pkg_key, pkg_digest, len(package_data)),
    )

    return {
        "paper_id": paper_id,
        "variant": variant_name,
        "data_version": data_version,
        "storage_key": pkg_key,
        "sha256": pkg_digest,
        "bytes": len(package_data),
    }


def ingest_data_and_images(
    data: QnADatabase,
    paper_id: str,
    images: Dict[str, bytes],
    settings: Settings | None = None,
) -> IngestResult:
    """Ingest Q&A database and images transactionally with content addressing."""
    config = settings or get_settings()
    storage = get_storage(config)

    # Validate image references in question content
    referenced_images = set()
    for q in data.questions:
        referenced_images.update(Path(img).name for img in q.content.imagePaths if img)
        for opt in q.options:
            referenced_images.update(Path(img).name for img in opt.imagePaths if img)
        referenced_images.update(Path(img).name for img in q.explanation.imagePaths if img)

    # Check for missing images
    missing = [img for img in referenced_images if img not in images]
    if missing:
        # Check if already in storage for this paper
        with get_db(config) as check_conn:
            existing_assets = {
                r[0]
                for r in check_conn.execute("SELECT filename FROM assets WHERE paper_id = ?", (paper_id,)).fetchall()
            }
        missing = [img for img in missing if img not in existing_assets]
        if missing:
            raise ValueError(f"Missing referenced images for paper {paper_id}: {missing[:5]}")

    # Process and store all provided images
    asset_rows = []
    variant_rows = []
    for filename, img_bytes in images.items():
        if not FILENAME_RE.fullmatch(filename):
            continue
        a_row, v_rows = process_image_bytes(storage, paper_id, filename, img_bytes, config.assets_dir)
        asset_rows.append(a_row)
        variant_rows.extend(v_rows)

    # Calculate combined content hash (canonical JSON + sorted asset sha256s)
    canonical = data.model_dump(mode="json", by_alias=True)
    canonical_json_bytes = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    qna_digest = hashlib.sha256(canonical_json_bytes).hexdigest()

    asset_digests = sorted(a["sha256"] for a in asset_rows)
    combined_hash = hashlib.sha256(f"{qna_digest}:{','.join(asset_digests)}".encode()).hexdigest()

    with get_db(config) as connection:
        with connection:
            status = replace_paper(connection, paper_id, data, combined_hash)
            row = connection.execute("SELECT data_version FROM papers WHERE id = ?", (paper_id,)).fetchone()
            curr_version = row["data_version"] if row else 1

            if status != "unchanged":
                # Delete old asset rows for paper
                connection.execute("DELETE FROM asset_variants WHERE paper_id = ?", (paper_id,))
                connection.execute("DELETE FROM assets WHERE paper_id = ?", (paper_id,))

                for a in asset_rows:
                    connection.execute(
                        """INSERT INTO assets(paper_id, filename, sha256, storage_key, bytes, width, height, role, question_id)
                           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (a["paper_id"], a["filename"], a["sha256"], a["storage_key"], a["bytes"],
                         a["width"], a["height"], a["role"], a["question_id"]),
                    )

                for v in variant_rows:
                    connection.execute(
                        """INSERT INTO asset_variants(paper_id, filename, variant, format, sha256, storage_key, bytes)
                           VALUES(?, ?, ?, ?, ?, ?, ?)""",
                        (v["paper_id"], v["filename"], v["variant"], v["format"], v["sha256"], v["storage_key"], v["bytes"]),
                    )

                build_paper_package(connection, storage, paper_id, curr_version, "w720", config)

    return IngestResult(paper_id=paper_id, status=status, data_version=curr_version)


def ingest_file(path: Path, settings: Settings | None = None) -> IngestResult:
    """Validate one Q&A JSON, read its companion images, and ingest."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        paper_id = paper_id_for(raw, path)
        data = QnADatabase.model_validate(raw)

        images = {}
        images_dir = path.parent / "images"
        if images_dir.is_dir():
            for img_file in images_dir.iterdir():
                if img_file.is_file() and FILENAME_RE.fullmatch(img_file.name):
                    images[img_file.name] = img_file.read_bytes()

        return ingest_data_and_images(data, paper_id, images, settings)
    except (OSError, ValueError, ValidationError, json.JSONDecodeError) as exc:
        return IngestResult(None, "failed", str(exc))


def ingest_zip(zip_bytes: bytes, settings: Settings | None = None) -> IngestResult:
    """Ingest a zipped paper package containing qna_database.json and images/."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
        qna_entry = None
        images = {}

        for info in zf.infolist():
            # Zip-slip guard
            if info.filename.startswith("/") or ".." in info.filename:
                raise ValueError("Zip contains illegal file paths")
            if info.file_size > MAX_ASSET_BYTES:
                raise ValueError(f"File {info.filename} exceeds maximum size")

            name = Path(info.filename).name
            if name == "qna_database.json" or (name.endswith(".json") and "qna" in name):
                qna_entry = info.filename
            elif FILENAME_RE.fullmatch(name):
                images[name] = zf.read(info)

        if not qna_entry:
            raise ValueError("No qna_database.json found in zip")

        raw = json.loads(zf.read(qna_entry).decode("utf-8"))
        paper_id = paper_id_for(raw)
        data = QnADatabase.model_validate(raw)

        return ingest_data_and_images(data, paper_id, images, settings)
    except Exception as exc:
        return IngestResult(None, "failed", str(exc))


def replace_single_asset(
    paper_id: str,
    filename: str,
    data: bytes,
    settings: Settings | None = None,
) -> Dict[str, Any]:
    """Replace an individual asset screenshot, bump paper data_version, rebuild package."""
    config = settings or get_settings()
    storage = get_storage(config)

    if not PAPER_RE.fullmatch(paper_id) or not FILENAME_RE.fullmatch(filename):
        raise ValueError("Invalid paper ID or filename")

    a_row, v_rows = process_image_bytes(storage, paper_id, filename, data, config.assets_dir)

    with get_db(config) as connection:
        with connection:
            paper = connection.execute("SELECT content_hash, data_version FROM papers WHERE id = ?", (paper_id,)).fetchone()
            if not paper:
                raise ValueError(f"Paper '{paper_id}' not found")

            # Upsert asset
            connection.execute(
                """INSERT INTO assets(paper_id, filename, sha256, storage_key, bytes, width, height, role, question_id)
                   VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(paper_id, filename) DO UPDATE SET
                   sha256=excluded.sha256, storage_key=excluded.storage_key, bytes=excluded.bytes,
                   width=excluded.width, height=excluded.height""",
                (a_row["paper_id"], a_row["filename"], a_row["sha256"], a_row["storage_key"],
                 a_row["bytes"], a_row["width"], a_row["height"], a_row["role"], a_row["question_id"]),
            )

            # Upsert variants
            for v in v_rows:
                connection.execute(
                    """INSERT INTO asset_variants(paper_id, filename, variant, format, sha256, storage_key, bytes)
                       VALUES(?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(paper_id, filename, variant) DO UPDATE SET
                       sha256=excluded.sha256, storage_key=excluded.storage_key, bytes=excluded.bytes""",
                    (v["paper_id"], v["filename"], v["variant"], v["format"], v["sha256"], v["storage_key"], v["bytes"]),
                )

            # Bump version and hash
            new_version = paper["data_version"] + 1
            new_hash = hashlib.sha256(f"{paper['content_hash']}:{a_row['sha256']}".encode()).hexdigest()
            connection.execute(
                "UPDATE papers SET content_hash = ?, data_version = ?, updated_at = datetime('now') WHERE id = ?",
                (new_hash, new_version, paper_id),
            )

            # Rebuild package
            build_paper_package(connection, storage, paper_id, new_version, "w720", config)

    return {
        "paper_id": paper_id,
        "filename": filename,
        "sha256": a_row["sha256"],
        "data_version": new_version,
    }


def seed_directory(directory: Path, settings: Settings | None = None) -> dict[str, int]:
    """Ingest every qna_database.json beneath a directory and return counts."""
    summary = {"inserted": 0, "updated": 0, "unchanged": 0, "failed": 0}
    for path in sorted(directory.rglob("qna_database.json")):
        result = ingest_file(path, settings)
        print(f"{result.paper_id or path}: {result.status}" + (f" ({result.reason})" if result.reason else ""))
        summary[result.status] += 1
    return summary
