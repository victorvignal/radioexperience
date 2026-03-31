from pathlib import Path
import csv
import shutil

base = Path(r'C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG\raw\geral')
log = Path(r'C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG\catalog\geral_reorg_moves.csv')

moves = []

def classify(name: str, folder: str):
    lower = name.lower()
    if lower.startswith('cabeca_pescoco_'):
        return 'cabeca_pescoco'
    if lower.startswith('obstetricia_') or lower.startswith('o-rads'):
        return 'obstetricia'
    if lower.startswith('urgencia_'):
        return 'urgencia'
    if lower.startswith('geral_') or lower.startswith('ceus-') or lower.startswith('chapter-') or lower.startswith('ti-rads'):
        return 'geral_core'
    return None

for folder in ['books', 'articles', 'guidelines']:
    src_dir = base / folder
    if not src_dir.exists():
        continue
    for f in sorted(src_dir.glob('*.pdf')):
        domain = classify(f.name, folder)
        if not domain:
            continue
        dst_dir = base / domain / folder
        dst_dir.mkdir(parents=True, exist_ok=True)
        dst = dst_dir / f.name
        if dst.exists():
            continue
        shutil.move(str(f), str(dst))
        moves.append({'from': str(f), 'to': str(dst), 'domain': domain, 'folder': folder})

with log.open('w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=['from', 'to', 'domain', 'folder'])
    w.writeheader()
    w.writerows(moves)

print(f'moved={len(moves)}')
print(log)
