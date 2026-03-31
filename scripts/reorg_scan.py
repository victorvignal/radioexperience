from pathlib import Path
import csv

base = Path(r'C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG\raw')
out = Path(r'C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG\catalog\reorg_candidates.csv')
out.parent.mkdir(parents=True, exist_ok=True)
rows = []
for f in sorted(base.rglob('*.pdf')):
    rel = f.relative_to(base)
    parts = rel.parts
    specialty = parts[0] if len(parts) > 0 else ''
    folder = parts[1] if len(parts) > 1 else ''
    name = f.name
    lower = name.lower()
    issues = []
    suggested_folder = folder

    if '_dup' in lower:
        issues.append('duplicate_suffix')
    if 'guideline' in lower and folder != 'guidelines':
        issues.append('guideline_misfiled')
        suggested_folder = 'guidelines'
    elif ('script' in lower or 'protocolo' in lower or 'template' in lower or 'algorithm' in lower) and folder == 'books':
        issues.append('book_folder_mixed_content')

    if issues:
        rows.append({
            'path': str(f),
            'specialty': specialty,
            'current_folder': folder,
            'file_name': name,
            'issues': ';'.join(issues),
            'suggested_folder': suggested_folder,
        })

with out.open('w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=['path', 'specialty', 'current_folder', 'file_name', 'issues', 'suggested_folder'])
    w.writeheader()
    w.writerows(rows)

print(f'Candidates: {len(rows)}')
print(out)
