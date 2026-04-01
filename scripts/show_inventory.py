"""
Show book inventory by specialty from catalog CSV.
Reads RAG_BASE_PATH from ../.env (falls back to default if not set).

Usage: python show_inventory.py
"""
import os
import csv
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

rag_base = os.getenv("RAG_BASE_PATH", r"C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG")
inv = Path(rag_base) / "catalog" / "full_inventory.csv"
rows = list(csv.DictReader(inv.open(encoding='utf-8')))

for spec in sorted(set(r['specialty'] for r in rows)):
    spec_rows = [r for r in rows if r['specialty'] == spec]
    total_mb = sum(float(r['size_mb']) for r in spec_rows)
    print(f'{spec} ({len(spec_rows)} arquivos, {total_mb:.0f} MB):')
    for t in ['books', 'articles', 'guidelines']:
        t_rows = [r for r in spec_rows if r['doc_type'] == t]
        if t_rows:
            print(f'  {t} ({len(t_rows)}):')
            for r in t_rows:
                name = r['file_name'][:80]
                mb = r['size_mb']
                print(f'    {name} ({mb} MB)')
    print()
