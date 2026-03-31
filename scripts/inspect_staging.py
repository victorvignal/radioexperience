import argparse
import json
import sys
from pathlib import Path


if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description='Inspeciona JSON de staging do RadioeXperience.')
    parser.add_argument('--input', required=True, help='Arquivo JSON do staging')
    parser.add_argument('--chunk', type=int, default=1, help='Chunk 1-indexado para inspecionar')
    args = parser.parse_args()

    path = Path(args.input)
    payload = json.loads(path.read_text(encoding='utf-8'))
    chunks = payload.get('all_chunks') or payload.get('chunk_sample', [])
    idx = max(1, args.chunk) - 1
    if idx >= len(chunks):
        raise SystemExit(f'Chunk {args.chunk} fora do intervalo. Total disponível: {len(chunks)}')

    chunk = chunks[idx]
    out = {
        'file_name': payload.get('file_name'),
        'chunk_index': args.chunk,
        'pages': chunk.get('page_numbers'),
        'page_start': chunk.get('page_start'),
        'page_end': chunk.get('page_end'),
        'chars': chunk.get('chars'),
        'figure_refs': chunk.get('figure_refs'),
        'linked_images_count': chunk.get('linked_images_count'),
        'linked_images': chunk.get('linked_images'),
        'text_preview': chunk.get('text', '')[:1800],
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
