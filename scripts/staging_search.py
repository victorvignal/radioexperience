import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path
from collections import Counter


if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def normalize_for_search(text: str) -> str:
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def score_chunk(query_terms, chunk):
    haystack = normalize_for_search(chunk.get('text', ''))
    if not haystack:
        return 0
    score = 0
    for term in query_terms:
        if term in haystack:
            score += 3
            score += haystack.count(term)
    return score


def load_chunks(staging_dir: Path):
    rows = []
    for path in sorted(staging_dir.glob('*.json')):
        payload = json.loads(path.read_text(encoding='utf-8'))
        chunks = payload.get('all_chunks') or payload.get('chunk_sample', [])
        for chunk in chunks:
            rows.append({
                'file_name': payload.get('file_name', path.name),
                'path': str(path),
                'chunk_index': chunk.get('chunk_index'),
                'page_start': chunk.get('page_start'),
                'page_end': chunk.get('page_end'),
                'page_numbers': chunk.get('page_numbers', []),
                'linked_images_count': chunk.get('linked_images_count', 0),
                'figure_refs': chunk.get('figure_refs', []),
                'text': chunk.get('text', ''),
            })
    return rows


def main():
    parser = argparse.ArgumentParser(description='Busca local simples no staging do RadioeXperience.')
    parser.add_argument('--input', required=True, help='Diretório com JSONs do staging')
    parser.add_argument('--query', required=True, help='Consulta textual simples')
    parser.add_argument('--top', type=int, default=5, help='Número de resultados')
    args = parser.parse_args()

    staging_dir = Path(args.input)
    rows = load_chunks(staging_dir)
    query_terms = [t for t in normalize_for_search(args.query).split(' ') if len(t) >= 2]
    ranked = []
    for row in rows:
        score = score_chunk(query_terms, row)
        if score > 0:
            ranked.append((score, row))
    ranked.sort(key=lambda x: (-x[0], x[1]['file_name'], x[1]['chunk_index']))

    out = []
    for score, row in ranked[: args.top]:
        out.append({
            'score': score,
            'file_name': row['file_name'],
            'chunk_index': row['chunk_index'],
            'pages': row['page_numbers'],
            'linked_images_count': row['linked_images_count'],
            'figure_refs': row['figure_refs'],
            'text_preview': row['text'][:900],
        })

    summary = {
        'query': args.query,
        'query_terms': query_terms,
        'documents_loaded': len(set(row['file_name'] for row in rows)),
        'chunks_loaded': len(rows),
        'results': out,
        'images_in_top_results': sum(r['linked_images_count'] for r in out),
        'document_hit_counts': dict(Counter(r['file_name'] for r in out)),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
