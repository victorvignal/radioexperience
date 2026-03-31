"""Compare text quality between two pilot staging versions."""
import sys
import json
import re
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def load_chunks(path: Path):
    data = json.loads(path.read_text(encoding='utf-8'))
    return data.get('all_chunks') or data.get('chunk_sample', [])


def count_hyphen_breaks(chunks):
    total = 0
    for ch in chunks:
        total += len(re.findall(r'\w-\n\w', ch.get('text', '')))
    return total


def count_stuck_e(chunks):
    """Count 'é' still glued to surrounding words."""
    total = 0
    for ch in chunks:
        total += len(re.findall(r'[a-zà-ÿ]é[a-zà-ÿ]', ch.get('text', '')))
    return total


def main():
    base = Path('radioexperience/data/staging')
    v7 = base / 'mama_pilot_v7_full' / 'Mama_Livro_Apostila_Mama_Radiocurso_Mamografia_Semautor_Seman_Semautor_SemAno.json'
    v8 = base / 'mama_pilot_v8' / 'Mama_Livro_Apostila_Mama_Radiocurso_Mamografia_Semautor_Seman_Semautor_SemAno.json'

    chunks_v7 = load_chunks(v7)
    chunks_v8 = load_chunks(v8)

    print(f"File: Apostila Mama Radiocurso")
    print(f"  chunks v7: {len(chunks_v7)}, v8: {len(chunks_v8)}")
    print()

    hyph_v7 = count_hyphen_breaks(chunks_v7)
    hyph_v8 = count_hyphen_breaks(chunks_v8)
    print(f"  Hyphen-break leftovers   v7={hyph_v7}  v8={hyph_v8}  (lower is better)")

    stuck_v7 = count_stuck_e(chunks_v7)
    stuck_v8 = count_stuck_e(chunks_v8)
    print(f"  Stuck 'é' patterns       v7={stuck_v7}  v8={stuck_v8}  (lower is better)")

    print()
    print("=== Sample: v7 chunk 7 first 500 chars ===")
    if len(chunks_v7) >= 7:
        print(chunks_v7[6]['text'][:500])

    print()
    print("=== Sample: v8 chunk 7 first 500 chars ===")
    if len(chunks_v8) >= 7:
        print(chunks_v8[6]['text'][:500])


if __name__ == '__main__':
    main()
