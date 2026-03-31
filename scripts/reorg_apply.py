from pathlib import Path
import csv
import shutil

base = Path(r'C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG\raw')
candidates = Path(r'C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG\catalog\reorg_candidates.csv')
logfile = Path(r'C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG\catalog\reorg_applied.csv')
rows = list(csv.DictReader(candidates.open(encoding='utf-8')))
applied = []

for r in rows:
    src = Path(r['path'])
    if not src.exists():
        continue
    issues = set(r['issues'].split(';')) if r['issues'] else set()
    specialty = r['specialty']
    current_folder = r['current_folder']
    target_folder = None

    if 'guideline_misfiled' in issues:
        target_folder = 'guidelines'
    elif 'book_folder_mixed_content' in issues and current_folder == 'books':
        target_folder = 'articles'

    if not target_folder or target_folder == current_folder:
        continue

    dst_dir = base / specialty / target_folder
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / src.name
    if dst.exists():
        continue
    shutil.move(str(src), str(dst))
    applied.append({'from': str(src), 'to': str(dst), 'action': 'move'})

with logfile.open('w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=['from', 'to', 'action'])
    w.writeheader()
    w.writerows(applied)

print(f'Moved: {len(applied)}')
print(logfile)
