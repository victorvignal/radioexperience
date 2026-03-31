import csv
from pathlib import Path

inv = Path(r'C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG\catalog\full_inventory.csv')
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
