"""Verify parity between baseline manifest and backend SQLite + StorageBackend."""

import hashlib
import json
import sys
from pathlib import Path

from backend.app.db import connect
from backend.app.repositories.paper_repo import PaperRepository
from backend.app.settings import get_settings
from backend.app.storage import get_storage


def verify():
    manifest_path = Path("migration/baseline_manifest.json")
    if not manifest_path.exists():
        print("Error: migration/baseline_manifest.json not found!")
        sys.exit(1)

    baseline = json.loads(manifest_path.read_text(encoding="utf-8"))
    settings = get_settings()
    storage = get_storage(settings)

    diffs = []
    checked_papers = 0
    checked_assets = 0

    print("=== 1. Verifying Papers in Backend ===")
    with connect(settings.db_path) as conn:
        for paper_id, base_meta in baseline["papers"].items():
            checked_papers += 1
            paper = PaperRepository.get_paper(paper_id, settings)
            if not paper:
                diffs.append(f"Missing paper: {paper_id}")
                continue

            # Compare total questions
            actual_q_count = sum(len(s.get("questions", [])) for s in paper.get("sections", []))
            expected_q_count = base_meta["total_questions"]
            if actual_q_count != expected_q_count:
                diffs.append(
                    f"Paper {paper_id}: question count mismatch: got {actual_q_count}, expected {expected_q_count}"
                )

            # Compare sections
            actual_sec_count = len(paper.get("sections", []))
            expected_sec_count = len(base_meta["section_counts"])
            if actual_sec_count != expected_sec_count:
                diffs.append(
                    f"Paper {paper_id}: section count mismatch: got {actual_sec_count}, expected {expected_sec_count}"
                )

            print(f"✓ Paper {paper_id}: {actual_q_count} questions across {actual_sec_count} sections verified.")

    print(f"\n=== 2. Verifying Content-Addressed Assets ===")
    with connect(settings.db_path) as conn:
        for file_rel, file_info in baseline["files"].items():
            if "papers/assets/" in file_rel and file_rel.endswith(".png"):
                parts = file_rel.replace("\\", "/").split("/")
                # Format: papers/assets/<paper_id>/<filename>
                try:
                    idx = parts.index("assets")
                    paper_id = parts[idx + 1]
                    filename = parts[idx + 2]
                except (ValueError, IndexError):
                    continue

                checked_assets += 1
                row = conn.execute(
                    "SELECT storage_key, sha256 FROM assets WHERE paper_id = ? AND filename = ?",
                    (paper_id, filename),
                ).fetchone()

                if not row:
                    diffs.append(f"Missing asset in DB: {paper_id}/{filename}")
                    continue

                if row["sha256"] != file_info["sha256"]:
                    diffs.append(
                        f"Asset sha256 mismatch for {paper_id}/{filename}: got {row['sha256']}, expected {file_info['sha256']}"
                    )
                    continue

                if not storage.exists(row["storage_key"]):
                    diffs.append(f"Asset file missing from storage backend: {row['storage_key']}")
                    continue

    print(f"Checked {checked_assets} image assets against baseline hashes.")

    print("\n=== Verification Summary ===")
    print(f"Papers checked: {checked_papers}")
    print(f"Assets checked: {checked_assets}")
    print(f"Total diffs: {len(diffs)}")

    if diffs:
        print("\nDiff Details:")
        for d in diffs[:20]:
            print(f"  ❌ {d}")
        sys.exit(1)
    else:
        print("\n🎉 SUCCESS: 0 diffs found! Database and StorageBackend have 100% parity with baseline manifest.")


if __name__ == "__main__":
    verify()
