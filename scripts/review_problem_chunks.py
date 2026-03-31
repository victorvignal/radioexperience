import argparse
import json
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def load_chunks(staging_dir: Path):
    for path in sorted(staging_dir.glob('*.json')):
        payload = json.loads(path.read_text(encoding='utf-8'))
        chunks = payload.get('all_chunks') or payload.get('chunk_sample', [])
        for chunk in chunks:
            yield {
                'file_name': payload.get('file_name', path.name),
                'path': str(path),
                'chunk_index': chunk.get('chunk_index'),
                'page_numbers': chunk.get('page_numbers', []),
                'linked_images_count': chunk.get('linked_images_count', 0),
                'text': chunk.get('text', ''),
            }


def score_noise(text: str):
    reasons = []
    score = 0

    hyphen_breaks = len(re.findall(r'\w-\n\w', text))
    if hyphen_breaks:
        score += hyphen_breaks * 4
        reasons.append(f'hyphen_breaks={hyphen_breaks}')

    mojibake = len(re.findall(r'�', text))
    if mojibake:
        score += mojibake * 3
        reasons.append(f'mojibake={mojibake}')

    # Real é-fusions: vowel immediately before é (OCR signature).
    # Excludes legitimate words like diabética, esférica (consonant before é).
    stuck_e = len(re.findall(r'\b[a-z\u00c0-\u00ff]{2,}[aeiou\u00e1\u00e9\u00ed\u00f3\u00fa\u00e2\u00ea\u00ee\u00f4\u00fb\u00e3\u00f5\u00e0\u00e8\u00ec\u00f2\u00f9\u00e4]\u00e9[a-z\u00c0-\u00ff]{3,}\b', text))
    if stuck_e:
        score += stuck_e * 3
        reasons.append(f'stuck_e={stuck_e}')

    fused_patterns = len(re.findall(r'(?i)(entreotecido|normaleo|doentee|semelhantesafolhas|associadaa|relacionadaa|propôsoestudo|propoosoestudo|elevamaconcentração|elevamaquantidade|associadaàgalactorr)', text))
    if fused_patterns:
        score += fused_patterns * 4
        reasons.append(f'fused_patterns={fused_patterns}')

    # ocr_spaced: word fragments with an accented char isolated by spaces between them.
    # Exclude:
    #   - 'à' (U+00E0) — legitimate standalone preposition "à"
    #   - 'é' (U+00E9) — legitimate standalone verb "é" (is)
    # Only flag: á, ó, ú, í, â, ê, ô, ã, õ, ç — these never appear as standalone words.
    ocr_spaced = len(
        re.findall(
            r'(?i)\b[a-z\u00c0-\u00ff]{2,}\s+[\u00e1\u00ed\u00f3\u00fa\u00e2\u00ea\u00f4\u00e3\u00f5\u00e7]\s+[a-z\u00c0-\u00ff-]{2,}\b',
            text,
        )
    )
    if ocr_spaced:
        score += ocr_spaced * 4
        reasons.append(f'ocr_spaced_tokens={ocr_spaced}')

    suspicious_long = len(
        re.findall(
            r'\b(?:[a-zà-ÿ]{10,}(?:e|a|o|de|da|do)[a-zà-ÿ]{8,}|[a-zà-ÿ]{22,})\b',
            text,
            flags=re.IGNORECASE,
        )
    )
    if suspicious_long:
        score += min(suspicious_long, 6)
        reasons.append(f'suspicious_long_tokens={suspicious_long}')

    return score, reasons


def main():
    parser = argparse.ArgumentParser(description='Ranqueia chunks suspeitos por ruído textual no staging.')
    parser.add_argument('--input', required=True, help='Diretório com JSONs do staging')
    parser.add_argument('--top', type=int, default=10, help='Número de chunks para revisar')
    args = parser.parse_args()

    staging_dir = Path(args.input)
    ranked = []
    total_chunks = 0

    for row in load_chunks(staging_dir):
        total_chunks += 1
        score, reasons = score_noise(row['text'])
        if score > 0:
            ranked.append({
                'score': score,
                'reasons': reasons,
                'file_name': row['file_name'],
                'chunk_index': row['chunk_index'],
                'pages': row['page_numbers'],
                'linked_images_count': row['linked_images_count'],
                'text_preview': row['text'][:700],
            })

    ranked.sort(key=lambda x: (-x['score'], x['file_name'], x['chunk_index'] or 0))

    out = {
        'input': str(staging_dir),
        'chunks_scanned': total_chunks,
        'problem_chunks_found': len(ranked),
        'top_problem_chunks': ranked[: args.top],
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
