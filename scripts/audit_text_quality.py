import argparse
import json
import re
import sys
from pathlib import Path
from collections import Counter

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def load_chunks(staging_dir: Path):
    for path in sorted(staging_dir.glob('*.json')):
        payload = json.loads(path.read_text(encoding='utf-8'))
        chunks = payload.get('all_chunks') or payload.get('chunk_sample', [])
        for chunk in chunks:
            yield payload.get('file_name', path.name), chunk


def main():
    parser = argparse.ArgumentParser(description='Audita qualidade textual dos chunks no staging.')
    parser.add_argument('--input', required=True, help='Diretório com JSONs do staging')
    parser.add_argument('--top', type=int, default=15, help='Quantidade de exemplos por categoria')
    args = parser.parse_args()

    staging_dir = Path(args.input)
    stats = Counter()
    stuck_examples = []
    fused_examples = []

    for file_name, chunk in load_chunks(staging_dir):
        text = chunk.get('text', '')
        stats['chunks'] += 1
        stats['chars'] += len(text)

        hyphen_hits = re.findall(r'\w-\n\w', text)
        stats['hyphen_breaks'] += len(hyphen_hits)

        # Real OCR fusion: 'é' (verb "is/are") sandwiched between two words without a space.
        # Key insight: Portuguese words that naturally contain 'é' always have a CONSONANT
        # immediately before 'é' (e.g. epidérmica: d+é, trabéculas: b+é, assimétrica: m+é).
        # OCR fusions place 'é' between a word ending in a VOWEL and the next word
        # (e.g. nóduloédifícil: o+é, cutâneaédiagnóstica: a+é, massaéindolor: a+é).
        # So: require vowel (including accented) immediately before 'é', ≥3 chars on each side.
        stuck_e = re.findall(r'\b[a-zà-ÿ]{2,}[aeiouáéíóúâêîôûãõàèìòùä]é[a-zà-ÿ]{3,}\b', text)
        stats['stuck_e'] += len(stuck_e)
        stats['stuck_e'] += len(stuck_e)
        for token in stuck_e[:3]:
            if len(stuck_examples) < args.top:
                stuck_examples.append({
                    'file_name': file_name,
                    'chunk_index': chunk.get('chunk_index'),
                    'token': token,
                })

        # Heuristic for likely fused words around common PT-BR glue patterns.
        # Require at least 3 letters on both sides to avoid matching normal short words.
        fused = re.findall(
            r'\b[a-zà-ÿ]{3,}(?:entreo|entrea|normaleo|doentee|associadaa|relacionadaa|semelhantesa|propooso|propoõeo|dever|mistaa)[a-zà-ÿ]{3,}\b',
            text,
            flags=re.IGNORECASE,
        )
        stats['likely_fused_tokens'] += len(fused)
        for token in fused[:3]:
            if len(fused_examples) < args.top:
                fused_examples.append({
                    'file_name': file_name,
                    'chunk_index': chunk.get('chunk_index'),
                    'token': token,
                })

    out = {
        'input': str(staging_dir),
        'chunks': stats['chunks'],
        'chars': stats['chars'],
        'hyphen_breaks': stats['hyphen_breaks'],
        'stuck_e': stats['stuck_e'],
        'likely_fused_tokens': stats['likely_fused_tokens'],
        'sample_stuck_e': stuck_examples,
        'sample_likely_fused_tokens': fused_examples,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
