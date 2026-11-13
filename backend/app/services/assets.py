"""Safe resolution for public paper image assets with content-addressing and variants."""

import hashlib
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from backend.app.storage.base import StorageBackend

PAPER_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")
FILENAME_RE = re.compile(r"^(q|opt|exp|asset)_[a-zA-Z0-9_.-]+\.(png|webp|jpg|jpeg)$")


@dataclass
class ResolvedAsset:
    """Metadata of an asset resolved from DB and StorageBackend."""

    storage_key: str
    sha256: str
    bytes: int
    content_type: str
    direct_path: Optional[Path] = None


def resolve_asset(
    connection: sqlite3.Connection,
    storage: StorageBackend,
    paper_id: str,
    filename: str,
    target_width: Optional[int] = None,
    accept_webp: bool = False,
    local_fallback_dir: Optional[Path] = None,
) -> Optional[ResolvedAsset]:
    """Resolve an asset to its content-addressed storage key or pre-generated variant."""
    if not PAPER_RE.fullmatch(paper_id) or not FILENAME_RE.fullmatch(filename):
        return None

    cursor = connection.cursor()

    # 1. Check if a width or webp variant was requested
    if target_width is not None or accept_webp:
        cursor.execute(
            """SELECT variant, format, sha256, storage_key, bytes
               FROM asset_variants
               WHERE paper_id = ? AND filename = ?
               ORDER BY bytes ASC""",
            (paper_id, filename),
        )
        variants = cursor.fetchall()
        if variants:
            chosen = None
            if target_width:
                desired = f"w{target_width}"
                for v in variants:
                    if v["variant"] == desired:
                        chosen = v
                        break
                if not chosen:
                    # Pick closest variant
                    widths = [(int(v["variant"][1:]), v) for v in variants if v["variant"].startswith("w")]
                    if widths:
                        widths.sort(key=lambda item: abs(item[0] - target_width))
                        chosen = widths[0][1]
            elif accept_webp:
                for v in variants:
                    if v["format"] == "webp":
                        chosen = v
                        break

            if chosen and storage.exists(chosen["storage_key"]):
                return ResolvedAsset(
                    storage_key=chosen["storage_key"],
                    sha256=chosen["sha256"],
                    bytes=chosen["bytes"],
                    content_type="image/webp" if chosen["format"] == "webp" else "image/png",
                )

    # 2. Check canonical assets table
    cursor.execute(
        "SELECT sha256, storage_key, bytes FROM assets WHERE paper_id = ? AND filename = ?",
        (paper_id, filename),
    )
    row = cursor.fetchone()
    if row and storage.exists(row["storage_key"]):
        return ResolvedAsset(
            storage_key=row["storage_key"],
            sha256=row["sha256"],
            bytes=row["bytes"],
            content_type="image/png",
        )

    # 3. Fallback to filesystem if not yet ingested into assets table
    fallback_roots = []
    if local_fallback_dir:
        fallback_roots.append(local_fallback_dir)
    seeds_assets = Path(__file__).resolve().parent.parent.parent / "seeds" / "assets"
    if seeds_assets.is_dir():
        fallback_roots.append(seeds_assets)

    for fallback_dir in fallback_roots:
        root = fallback_dir.resolve()
        base = (root / paper_id).resolve()
        target = (base / filename).resolve()
        try:
            target.relative_to(root)
            if target.is_file():
                data = target.read_bytes()
                digest = hashlib.sha256(data).hexdigest()
                return ResolvedAsset(
                    storage_key=f"{paper_id}/{filename}",
                    sha256=digest,
                    bytes=len(data),
                    content_type="image/png",
                    direct_path=target,
                )
        except ValueError:
            continue

    return None
