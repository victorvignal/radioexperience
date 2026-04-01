"""
Find and move duplicate PDF files (by SHA-256 hash) within the raw corpus.
Reads RAG_BASE_PATH from ../.env (falls back to default if not set).

Usage: python dedupe_and_cleanup.py
"""
import os
from pathlib import Path
import csv
import shutil
import hashlib
from collections import defaultdict, Counter
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

rag_base = os.getenv("RAG_BASE_PATH", r"C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG")
base = Path(rag_base) / "raw"
catalog = Path(rag_base) / "catalog"
dups_dir = base / '_duplicates'
dups_dir.mkdir(parents=True, exist_ok=True)

move_log = []
dupe_rows = []

def filehash(path: Path, chunk=1024*1024):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()

files = [p for p in base.rglob('*.pdf') if '_duplicates' not in p.parts]
by_hash = defaultdict(list)
for p in files:
    try:
        by_hash[(p.stat().st_size, filehash(p))].append(p)
    except Exception:
        continue

for (_, h), group in by_hash.items():
    if len(group) < 2:
        continue
    group = sorted(group, key=lambda p: ('_dup' in p.name.lower(), len(str(p))))
    keep = group[0]
    for p in group[1:]:
        rel = p.relative_to(base)
        target = dups_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            shutil.move(str(p), str(target))
            move_log.append({'from': str(p), 'to': str(target), 'action': 'move_duplicate'})
        dupe_rows.append({'kept': str(keep), 'moved_duplicate': str(target), 'sha256': h, 'size_bytes': keep.stat().st_size})

# Re-inventory after moves
rows = []
for f in sorted(base.rglob('*.pdf')):
    if '_duplicates' in f.parts:
        continue
    rel = f.relative_to(base)
    parts = rel.parts
    specialty = parts[0] if len(parts) > 0 else ''
    doc_type = parts[1] if len(parts) > 1 else ''
    rows.append({
        'specialty': specialty,
        'doc_type': doc_type,
        'file_name': f.name,
        'size_mb': round(f.stat().st_size / 1024 / 1024, 2),
        'path': str(f)
    })

with (catalog / 'duplicates_report.csv').open('w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=['kept', 'moved_duplicate', 'sha256', 'size_bytes'])
    w.writeheader(); w.writerows(dupe_rows)

with (catalog / 'cleanup_moves.csv').open('w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=['from', 'to', 'action'])
    w.writeheader(); w.writerows(move_log)

with (catalog / 'full_inventory_clean.csv').open('w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=['specialty', 'doc_type', 'file_name', 'size_mb', 'path'])
    w.writeheader(); w.writerows(rows)

print(f'duplicates_moved={len(move_log)}')
print(f'clean_files={len(rows)}')
print(str(catalog / 'duplicates_report.csv'))
print(str(catalog / 'cleanup_moves.csv'))
print(str(catalog / 'full_inventory_clean.csv'))
