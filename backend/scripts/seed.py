"""Seed canonical papers from a Q&A export directory."""

import argparse
from pathlib import Path

from backend.app.services.ingest import seed_directory


def main() -> None:
    """Run the idempotent paper seeder."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", type=Path, default=Path("dist/qna"))
    args = parser.parse_args()
    summary = seed_directory(args.dir)
    print(" / ".join(f"{count} {status}" for status, count in summary.items()))


if __name__ == "__main__":
    main()
