import hashlib
import json
from pathlib import Path

base_dir = Path("testbench/public")
targets = ["papers", "qna"]
manifest = {
    "files": {},
    "papers": {},
    "qnas": {}
}

for target in targets:
    t_path = base_dir / target
    if not t_path.exists():
        continue
    for file_path in sorted(t_path.rglob("*")):
        if file_path.is_file():
            rel_path = file_path.relative_to(base_dir).as_posix()
            data = file_path.read_bytes()
            h = hashlib.sha256(data).hexdigest()
            manifest["files"][rel_path] = {
                "sha256": h,
                "bytes": len(data)
            }
            if rel_path.endswith(".json") and "papers/" in rel_path and "catalog.json" not in rel_path:
                try:
                    pj = json.loads(data.decode("utf-8"))
                    if isinstance(pj, dict) and "id" in pj:
                        sec_counts = {}
                        tot_q = 0
                        answer_keys = {}
                        for sec in pj.get("sections", []):
                            s_id = sec.get("id", "")
                            qs = sec.get("questions", [])
                            sec_counts[s_id] = len(qs)
                            tot_q += len(qs)
                            for q in qs:
                                q_id = str(q.get("id", q.get("questionId", "")))
                                answer_keys[q_id] = q.get("correctAnswer") or q.get("answer")
                        manifest["papers"][pj["id"]] = {
                            "title": pj.get("title"),
                            "exam": pj.get("exam"),
                            "year": pj.get("year"),
                            "total_questions": tot_q,
                            "section_counts": sec_counts,
                            "answer_keys_count": len(answer_keys)
                        }
                except Exception as e:
                    print(f"Error parsing paper {rel_path}: {e}")
            elif rel_path.endswith(".json") and "qna/" in rel_path:
                try:
                    qj = json.loads(data.decode("utf-8"))
                    if isinstance(qj, dict) and "questions" in qj:
                        stem = file_path.stem
                        meta = qj.get("examMetadata", {})
                        manifest["qnas"][stem] = {
                            "title": f"{meta.get('examName', '')} {meta.get('year', '')}".strip() or stem,
                            "schemaVersion": qj.get("schemaVersion", "1.0"),
                            "totalQuestions": meta.get("totalQuestions", len(qj.get("questions", []))),
                            "question_count": len(qj.get("questions", []))
                        }
                except Exception as e:
                    print(f"Error parsing qna {rel_path}: {e}")

out_path = Path("migration/baseline_manifest.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(f"Wrote baseline manifest with {len(manifest['files'])} files, {len(manifest['papers'])} papers, {len(manifest['qnas'])} qnas.")
