from pathlib import Path
import subprocess
import json

base = Path(r'C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG')
raw = base / 'raw'
staging = base / 'processed' / 'staging'
results = []

cases = []
for spec in sorted(p for p in raw.iterdir() if p.is_dir() and p.name != '_duplicates'):
    if spec.name == 'geral':
        for sub in sorted(p for p in spec.iterdir() if p.is_dir() and p.name in {'cabeca_pescoco','obstetricia','urgencia','geral_core'}):
            cases.append((f'geral_{sub.name}', sub))
    else:
        cases.append((spec.name, spec))

for name, root in cases:
    pdfs = sorted(root.rglob('*.pdf'))
    if not pdfs:
        continue
    out = staging / f'{name}_fulltest_v1'
    out.mkdir(parents=True, exist_ok=True)
    print(f'[{name}] pdfs={len(pdfs)} ...', flush=True)
    subprocess.run([
        'python', '.\\radioexperience\\scripts\\rad_ingest.py', 'pilot',
        '--input', str(root),
        '--limit', str(len(pdfs)),
        '--output-dir', str(out)
    ], check=False)
    proc = subprocess.run([
        'python', '.\\radioexperience\\scripts\\rad_ingest.py', 'analyze-staging',
        '--input', str(out)
    ], capture_output=True, text=True, encoding='utf-8', errors='ignore')
    results.append({'name': name, 'pdfs': len(pdfs), 'analysis_stdout': proc.stdout.strip(), 'analysis_stderr': proc.stderr.strip()})
    print(f'[{name}] done', flush=True)

report = base / 'catalog' / 'full_base_test_report.json'
report.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(report)
print(f'cases={len(results)}')
