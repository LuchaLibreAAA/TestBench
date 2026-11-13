"""Seed all 9 papers (7 Q&A + assets if available, 2 CBT papers) into the canonical database and storage backend."""

import json
from pathlib import Path

from backend.app.db import migrate
from backend.app.services.ingest import ingest_data_and_images
from backend.app.settings import get_settings
from scripts.import_cbt_paper import import_cbt_file
from tools.pdf_qna_pipeline.models import QnADatabase


def seed_all():
    settings = get_settings()
    migrate(settings)

    # Search paths for QnA JSONs and assets (fallback to backend/seeds if public cleaned up)
    qna_dirs = [Path("backend/seeds/qna"), Path("testbench/public/qna")]
    qna_dir = next((d for d in qna_dirs if d.is_dir()), None)

    assets_base = Path("testbench/public/papers/assets")
    cbt_dirs = [Path("backend/seeds/papers"), Path("testbench/public/papers")]

    qna_to_paper_id = {
        "jee-main-2026-shift2": "jee-main-2026-apr-s2",
        "neet-ug-2023": "neet-ug-2023",
        "neet-ug-2024": "neet-ug-2024",
        "neet-ug-2025": "neet-ug-2025",
        "neet-ug-2026": "neet-ug-2026",
        "wbtet-2022": "wbtet-2022",
        "wbtet-2023": "wbtet-2023",
    }

    # 1. Ingest Q&A papers with images (if present)
    print("=== Ingesting Q&A Papers ===")
    if qna_dir:
        for stem, paper_id in qna_to_paper_id.items():
            qna_file = qna_dir / f"{stem}.json"
            if not qna_file.exists():
                print(f"Warning: {qna_file} not found!")
                continue

            raw = json.loads(qna_file.read_text(encoding="utf-8"))
            data = QnADatabase.model_validate(raw)

            images = {}
            paper_assets_dir = assets_base / paper_id
            if paper_assets_dir.is_dir():
                for f in paper_assets_dir.iterdir():
                    if f.is_file() and f.suffix.lower() in (".png", ".webp", ".jpg", ".jpeg"):
                        images[f.name] = f.read_bytes()

            print(f"Ingesting {paper_id} with {len(images)} images...")
            res = ingest_data_and_images(data, paper_id, images, settings)
            print(f"-> {paper_id}: {res.status} (version {res.data_version})")

    # 2. Ingest CBT papers (text/formula papers)
    print("\n=== Ingesting CBT Papers ===")
    cbt_papers = []
    for cdir in cbt_dirs:
        for p in ["jee-main-2024-jan-s1.json", "jee-main-2023-apr-s1.json"]:
            cand1 = cdir / "jee-main" / p
            cand2 = cdir / p
            if cand1.exists() and cand1 not in cbt_papers:
                cbt_papers.append(cand1)
            elif cand2.exists() and cand2 not in cbt_papers:
                cbt_papers.append(cand2)

    for cbt_file in cbt_papers:
        if cbt_file.exists():
            print(f"Ingesting CBT paper {cbt_file.name}...")
            res = import_cbt_file(cbt_file, settings)
            print(f"-> {cbt_file.stem}: {res.status} (version {res.data_version})")

    print("\nAll seeding complete!")


if __name__ == "__main__":
    seed_all()
