"""Safe resolution for public paper image assets."""

import re
from pathlib import Path

PAPER_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")
FILENAME_RE = re.compile(r"^(q|opt)_[0-9]+(_[0-9]+)?\.png$")


def resolve_asset(assets_dir: Path, paper_id: str, filename: str) -> Path | None:
    """Return a contained PNG file, rejecting malformed IDs and symlinks."""
    if not PAPER_RE.fullmatch(paper_id) or not FILENAME_RE.fullmatch(filename):
        return None
    root = assets_dir.resolve()
    base = (root / paper_id).resolve()
    target = (base / filename).resolve()
    if root not in base.parents or base not in target.parents or not target.is_file():
        return None
    return target
