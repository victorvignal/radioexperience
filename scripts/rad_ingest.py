import os
import re
import csv
import json
import uuid
import hashlib
import argparse
import sys
from pathlib import Path
from collections import Counter

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from pypdf import PdfReader
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import fitz  # PyMuPDF

COLLECTION_DEFAULT = os.getenv('QDRANT_COLLECTION', 'radioexperience_knowledge')
EMBED_MODEL = os.getenv('OPENAI_EMBED_MODEL', 'text-embedding-3-small')
EMBED_DIM = 1536
FIGURE_REF_RE = re.compile(r'\b(?:figura|fig\.?|imagem)\s*(\d+[A-Za-z\.-]*)', re.IGNORECASE)
START_HINTS = [
    '1. embriologia da mama', 'embriologia da mama', 'anatomia da mama', 'histologia da mama',
    'lesões mamárias benignas', 'lesões mamárias malignas', 'bi-rads', 'técnica radiológica',
    'capítulo 1', 'diagnóstico por imagem da mama'
]
END_NOISE_HINTS = [
    'copyright', 'todos os direitos reservados', 'prefácio', 'observação e renúncia',
    'catalogação', 'cip-brasil', 'editora', 'impresso no brasil', 'apresentação', 'carta do presidente',
    'método de ensino', 'estatísticas', 'sequência para estudo', 'conheça todos os nossos cursos',
    'manual de radiologia para concursos', 'radiocurso', 'índice'
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def list_pdfs(root: Path):
    return sorted(root.rglob('*.pdf'))


def extract_pages_pdf(path: Path):
    try:
        reader = PdfReader(str(path))
        pages = []
        for i, p in enumerate(reader.pages, start=1):
            pages.append({'page_number': i, 'text': p.extract_text() or ''})
        return pages
    except Exception:
        return []


def repair_common_mojibake(text: str) -> str:
    replacements = {
        'T�CNICA': 'TÉCNICA',
        'mamografia�': 'mamografia é',
        'resolu��o': 'resolução',
        'diferen�a': 'diferença',
        't�nue': 'tênue',
        'indispens�vel': 'indispensável',
        'alcan�ar': 'alcançar',
        'Situa��es': 'Situações',
        'obl�qua': 'oblíqua',
        'n�o': 'não',
        's�o': 'são',
        'radia��o': 'radiação',
        'mam�ria': 'mamária',
        'quest�o': 'questão',
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text


def rejoin_hyphen_breaks(text: str) -> str:
    """Join words broken by hyphenation at end-of-line, e.g. 'expan-\\ndido' -> 'expandido'."""
    return re.sub(r'(\w)-\n(\w)', r'\1\2', text)


def fix_stuck_words(text: str) -> str:
    """
    Lightweight heuristics for frequent glued-word artifacts seen in the mama pilot.
    Keep this conservative: prefer a few high-confidence fixes over broad rules.
    """
    # ── STEP 1: Fix OCR-broken words where accented char was split by spaces ──────────
    # These patterns fix cases like "s é rie" → "série", "diab é tic" → "diabétic"
    # MUST run BEFORE the fusion-split step to avoid conflicts.
    text = re.sub(r'\brec\s+\u00e9\s+m-nascidos\b', 'rec\u00e9m-nascidos', text, flags=re.IGNORECASE)
    text = re.sub(r'\bsim\s+\u00e9\s+trico\b', 'sim\u00e9trico', text, flags=re.IGNORECASE)
    text = re.sub(r'\bassim\s+\u00e9\s+trico\b', 'assim\u00e9trico', text, flags=re.IGNORECASE)
    text = re.sub(r'\bs\s+\u00e9\s+rie\b', 's\u00e9rie', text, flags=re.IGNORECASE)
    text = re.sub(r'\bcont\s+\u00e9\s+m\b', 'cont\u00e9m', text, flags=re.IGNORECASE)
    text = re.sub(r'\bdiab\s+\u00e9\s+tic', 'diab\u00e9tic', text, flags=re.IGNORECASE)
    text = re.sub(r'\bepid\s+\u00e9\s+rmic', 'epid\u00e9rmic', text, flags=re.IGNORECASE)
    text = re.sub(r'\best\s+\u00e9\s+ril\b', 'est\u00e9ril', text, flags=re.IGNORECASE)
    text = re.sub(r'\bdecr\s+\u00e9\s+scimo\b', 'decr\u00e9scimo', text, flags=re.IGNORECASE)
    text = re.sub(r'\bc\s+\u00e9\s+lul', 'c\u00e9lul', text, flags=re.IGNORECASE)
    text = re.sub(r'\bcardfac', 'card\u00edac', text, flags=re.IGNORECASE)
    text = re.sub(r'\b\u00e9p\s+itelio\b', 'epit\u00e9lio', text, flags=re.IGNORECASE)
    text = re.sub(r'\btamb\s+\u00e9\s+m\b', 'tamb\u00e9m', text, flags=re.IGNORECASE)
    text = re.sub(r'\bal\s+\u00e9\s+m\b', 'al\u00e9m', text, flags=re.IGNORECASE)
    text = re.sub(r'\bat\s+\u00e9\s+a\b', 'at\u00e9 a', text, flags=re.IGNORECASE)
    text = re.sub(r'\bat\s+\u00e9\s+\b', 'at\u00e9 ', text, flags=re.IGNORECASE)
    text = re.sub(r'\bmagn\s+\u00e9\s+tic', 'magn\u00e9tic', text, flags=re.IGNORECASE)
    # Generic: join "word_fragment SPACE accented_char SPACE word_fragment" back together.
    # This fixes OCR that split accented characters with spaces (e.g. "sim é trico" → "simétrico").
    # Only runs for truly short fragments (≤3 chars) to avoid joining real words.
    text = re.sub(
        r'\b([a-zA-Z\u00c0-\u00ff]{1,3})\s+([\u00e9\u00e1\u00f3\u00fa\u00ed\u00ea\u00e2\u00f4\u00e3\u00f5\u00e0])\s+([a-zA-Z\u00c0-\u00ff]{2,5})\b',
        r'\1\2\3',
        text,
    )
    text = re.sub(r'\bregi\u00f5?es\s+tipicamente\b', 'regi\u00f5es tipicamente', text, flags=re.IGNORECASE)

    # ── STEP 2: Split é-fusions (MUST run LAST) ─────────────────────────────────────
    # OCR fusion: 'é' (verb "is") stuck between two words without space.
    # Signature: vowel immediately before 'é' (nódulo+é, cutânea+é, massa+é).
    # Legitimate accented words always have a consonant before 'é' (diabética: b+é).
    text = re.sub(
        r'([aeiou\u00e1\u00e9\u00ed\u00f3\u00fa\u00e2\u00ea\u00ee\u00f4\u00fb\u00e3\u00f5\u00e0\u00e8\u00ec\u00f2\u00f9\u00e4])(\u00e9)([a-zA-Z\u00c0-\u00ff]{3,})',
        r'\1 \2 \3',
        text,
    )
    # Also split abbreviation/uppercase+é fusions (e.g. USéusado, RMéo, CDISéb)
    text = re.sub(
        r'([A-Z]{2,})(\u00e9)([a-zA-Z\u00c0-\u00ff]{1,})',
        r'\1 \2 \3',
        text,
    )
    # Split à-preposition fusions (e.g. adicionadoàlidocaína → adicionado à lidocaína)
    # Signature: word ending (consonant or vowel) + 'à' + word start (consonant or vowel)
    text = re.sub(
        r'([a-zA-Z\u00c0-\u00ff]{3,})(\u00e0)([a-zA-Z\u00c0-\u00ff]{3,})',
        r'\1 \2 \3',
        text,
    )

    direct_replacements = {
        'entreotecido': 'entre o tecido',
        'normaleo': 'normal e o',
        'doentee': 'doente e',
        'propôsoestudo': 'propôs o estudo',
        'tecnologiaeequipamento': 'tecnologia e equipamento',
        'duranteoexame': 'durante o exame',
        'durantealactação': 'durante a lactação',
        'histologiaeanomalias': 'histologia e anomalias',
        'Jáaprevalência': 'Já a prevalência',
        'variáveleaumenta': 'variável e aumenta',
        'circulaçãoeação': 'circulação e ação',
        'estrogênioedo': 'estrogênio e do',
        'associadoafatores': 'associado a fatores',
        'imagensaseguir': 'imagens a seguir',
        'sentinelaeradioterapia': 'sentinela e radioterapia',
        'Quandoaquestão': 'Quando a questão',
        'forneceainformação': 'fornece a informação',
        'queapaciente': 'que a paciente',
        'associadaamassa': 'associada a massa',
        'ouacisto': 'ou a cisto',
        'ecogênicaseligamentos': 'ecogênicas e ligamentos',
        'associadaahemorragia': 'associada a hemorragia',
        'associadasapadrões': 'associadas a padrões',
        'adicionaisadescrições': 'adicionais a descrições',
        'nódulosecalcificação': 'nódulos e calcificação',
        'grosseiraseheterogêneas': 'grosseiras e heterogêneas',
        'semelhantesafolhas': 'semelhantes a folhas',
        'semelhantesabastonetes': 'semelhantes a bastonetes',
        'relacionadaaum': 'relacionada a um',
        'próximaàpele': 'próxima à pele',
        'associadaatrauma': 'associada a trauma',
        'associadaacarcinoma': 'associada a carcinoma',
        'associadaatrombose': 'associada a trombose',
        'associadaacalcificações': 'associada a calcificações',
        'todaamama': 'toda a mama',
        'devidoaespessamento': 'devido a espessamento',
        'cutâneoetrabecular': 'cutâneo e trabecular',
        'mamografiaeexame': 'mamografia e exame',
        'galactoceleeabscesso': 'galactocele e abscesso',
        'incompletaenecessita': 'incompleta e necessita',
        'complementaoexame': 'complementa o exame',
        'extremidadesafiladas': 'extremidades afiladas',
        'globaleassimetria': 'global e assimetria',
        'centraleespessamento': 'central e espessamento',
        'imagemàesquerda': 'imagem à esquerda',
        'imagemàdireita': 'imagem à direita',
        'visualizarapele': 'visualizar a pele',
        'benignasemalignas': 'benignas e malignas',
        'inflamaçãoedegeneração': 'inflamação e degeneração',
        'muscularesebiópsia': 'musculares e biópsia',
        'homensecrianças': 'homens e crianças',
        'vasculitenecrotizante': 'vasculite necrotizante',
        'comaidade': 'com a idade',
        'recomendaarealização': 'recomenda a realização',
        'realizarorastreamento': 'realizar o rastreamento',
        'mamografiaapartir': 'mamografia a partir',
        'elevamaconcentração': 'elevam a concentração',
        'elevamaquantidade': 'elevam a quantidade',
        'associadaàgalactorréia': 'associada à galactorreia',
        'carcinomaductal': 'carcinoma ductal',
        'noteoaumento': 'note o aumento',
        'inferiormenteemedialmente': 'inferiormente e medialmente',
        'secundárioacausas': 'secundário a causas',
        'reduzasensibilidadeevalor': 'reduz a sensibilidade e valor',
        'algumascom': 'algumas com',
        'afiladasealgumas': 'afiladas e algumas',
        'associadasafibroadenomas': 'associadas a fibroadenomas',
        'observaramificação': 'observe a ramificação',
        'commassa': 'com massa',
        'glandulareseadiposos': 'glandulares e adiposos',
        'epatológica': 'e patológica',
        'associadoapadrão': 'associado a padrão',
        'paraamama': 'para a mama',
        'semelhantealeite': 'semelhante a leite',
        'gorduraesecreções': 'gordura e secreções',
        'específicosepodem': 'específicos e podem',
        'permeioereforço': 'permeio e reforço',
        'finaea': 'fina e a',
        'deotumor': 'de o tumor',
        'volumosoeapres': 'volumoso e apres',
        'comomelhor': 'como melhor',
        'queataxa': 'que a taxa',
        'sbmea': 'SBM e a',
        'amamografia': 'a mamografia',
        'paraocâncer': 'para o câncer',
        'entreoepitélioeo': 'entre o epitélio e o',
        'distribuição ductalesão distribuídas': 'distribuição ductal e são distribuídas',
        'redefineolimite': 'redefine o limite',
        'maisovolume': 'mais o volume',
        'simularmicrocalcificações': 'simular microcalcificações',
        'relacionadaagestação': 'relacionada a gestação',
        'relacionadaaamamentação': 'relacionada a amamentação',
        'relacionadaatraumati': 'relacionada a traumati',
        'todooprocedimento': 'todo o procedimento',
        'todooexame': 'todo o exame',
        'todaagestação': 'toda a gestação',
        'formaase': 'forma a se',
        'removeraagulha': 'remover a agulha',
        'seringaea': 'seringa e a',
        'arésugado': 'ar é sugado',
        'todoocampo': 'todo o campo',
    }
    for bad, good in direct_replacements.items():
        text = text.replace(bad, good)
    return text


def clean_text(text: str) -> str:
    text = repair_common_mojibake(text)
    text = text.replace('\r', '\n')
    text = rejoin_hyphen_breaks(text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'([A-Za-zÀ-ÿ])\s([A-Za-zÀ-ÿ])\s([A-Za-zÀ-ÿ])', lambda m: m.group(0).replace(' ', ''), text)
    text = re.sub(r'\bB1-RADS\b', 'BI-RADS', text, flags=re.IGNORECASE)
    text = re.sub(r'([A-Za-zÀ-ÿ])�([A-Za-zÀ-ÿ])', r'\1 \2', text)
    text = fix_stuck_words(text)
    return text.strip()


def is_noise_page(text: str) -> bool:
    t = text.lower()
    hits = sum(1 for h in END_NOISE_HINTS if h in t)
    return hits >= 2 and len(t) < 5000


def trim_front_matter(pages):
    if not pages:
        return pages
    start_idx = 0
    best_match = None
    for i, page in enumerate(pages[:60]):
        t = clean_text(page['text']).lower()
        if not t or is_noise_page(t):
            continue
        for hint in START_HINTS:
            if hint in t:
                best_match = i
                break
        if best_match is not None:
            break
    if best_match is not None:
        start_idx = best_match
    trimmed = pages[start_idx:]
    return trimmed


def get_clean_pages(pdf_path: Path):
    pages = trim_front_matter(extract_pages_pdf(pdf_path))
    cleaned_pages = []
    for p in pages:
        text = clean_text(p['text'])
        if not text:
            continue
        if is_noise_page(text):
            continue
        cleaned_pages.append({'page_number': p['page_number'], 'text': text})
    return cleaned_pages


def extract_text_pdf(path: Path) -> str:
    return '\n\n'.join(page['text'] for page in get_clean_pages(path))


def split_sections(text: str):
    parts = re.split(r'\n(?=(?:\d+\.?\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ].+|[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{8,}))', text)
    return [p.strip() for p in parts if p.strip()]


def extract_chunk_figure_refs(chunk: str):
    refs = FIGURE_REF_RE.findall(chunk)
    return sorted(set(refs))


def is_bad_chunk(chunk: str) -> bool:
    t = chunk.strip()
    tl = t.lower()
    if len(t) < 180:
        return True
    if t.isupper() and len(t) < 300:
        return True
    noise_hits = sum(1 for h in END_NOISE_HINTS if h in tl)
    if noise_hits >= 1:
        return True
    if 'www.' in tl and len(t) < 1200:
        return True
    if 'isbn' in tl and len(t) < 1500:
        return True
    return False


def chunk_text(text: str, chunk_size: int = 2600, overlap: int = 220):
    sections = split_sections(text)
    if not sections:
        sections = [text]
    chunks = []
    for sec in sections:
        if len(sec) <= chunk_size:
            if not is_bad_chunk(sec):
                chunks.append(sec)
            continue
        start = 0
        n = len(sec)
        while start < n:
            end = min(start + chunk_size, n)
            chunk = sec[start:end].strip()
            if chunk and not is_bad_chunk(chunk):
                chunks.append(chunk)
            if end == n:
                break
            start = max(end - overlap, start + 1)
    return chunks


def merge_small_adjacent_chunks(chunks, min_chars: int = 500, hard_max: int = 3200):
    if not chunks:
        return chunks

    merged = []
    for chunk in chunks:
        chunk = {**chunk}
        chunk['page_numbers'] = sorted(set(chunk['page_numbers']))
        chunk['chars'] = len(chunk['text'])
        chunk['figure_refs'] = extract_chunk_figure_refs(chunk['text'])

        if merged:
            prev = merged[-1]
            same_page = prev['page_end'] == chunk['page_start'] and set(prev['page_numbers']) == set(chunk['page_numbers'])
            contiguous = prev['page_end'] >= chunk['page_start'] - 1
            combined_len = prev['chars'] + 2 + chunk['chars']
            should_merge = chunk['chars'] < min_chars and (same_page or contiguous) and combined_len <= hard_max
            if should_merge:
                prev['text'] = f"{prev['text']}\n\n{chunk['text']}"
                prev['page_start'] = min(prev['page_start'], chunk['page_start'])
                prev['page_end'] = max(prev['page_end'], chunk['page_end'])
                prev['page_numbers'] = sorted(set(prev['page_numbers'] + chunk['page_numbers']))
                prev['chars'] = len(prev['text'])
                prev['figure_refs'] = sorted(set(prev['figure_refs'] + chunk['figure_refs']))
                continue
        merged.append(chunk)

    return merged


def chunk_pages_with_metadata(clean_pages, chunk_size: int = 2600, overlap: int = 220):
    chunks = []
    current_parts = []
    current_pages = []
    current_len = 0

    def flush():
        nonlocal current_parts, current_pages, current_len
        text = '\n\n'.join(current_parts).strip()
        if text and not is_bad_chunk(text):
            chunks.append({
                'text': text,
                'page_start': min(current_pages),
                'page_end': max(current_pages),
                'page_numbers': sorted(set(current_pages)),
                'chars': len(text),
                'figure_refs': extract_chunk_figure_refs(text),
            })
        current_parts = []
        current_pages = []
        current_len = 0

    for page in clean_pages:
        page_text = page['text']
        page_number = page['page_number']
        if len(page_text) > chunk_size:
            if current_parts:
                flush()
            for piece in chunk_text(page_text, chunk_size=chunk_size, overlap=overlap):
                if is_bad_chunk(piece):
                    continue
                chunks.append({
                    'text': piece,
                    'page_start': page_number,
                    'page_end': page_number,
                    'page_numbers': [page_number],
                    'chars': len(piece),
                    'figure_refs': extract_chunk_figure_refs(piece),
                })
            continue

        projected_len = current_len + (2 if current_parts else 0) + len(page_text)
        if current_parts and projected_len > chunk_size:
            flush()

        current_parts.append(page_text)
        current_pages.append(page_number)
        current_len = sum(len(part) for part in current_parts) + (2 * max(0, len(current_parts) - 1))

    if current_parts:
        flush()

    return merge_small_adjacent_chunks(chunks)


def extract_page_text_map(pdf_path: Path):
    return {page['page_number']: page['text'] for page in get_clean_pages(pdf_path)}


def infer_caption_from_page(page_text: str):
    if not page_text:
        return None
    lines = [ln.strip() for ln in page_text.split('\n') if ln.strip()]
    for ln in lines:
        if re.match(r'^(Figura|Fig\.?|Imagem)\s+\d+', ln, re.IGNORECASE):
            return ln[:500]
    return None


def extract_images_manifest(pdf_path: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    page_text_map = extract_page_text_map(pdf_path)
    manifest = []
    for page_index in range(len(doc)):
        page_number = page_index + 1
        if page_number not in page_text_map:
            continue
        page = doc[page_index]
        images = page.get_images(full=True)
        page_text = page_text_map.get(page_number, '')
        caption = infer_caption_from_page(page_text)
        figure_refs = extract_chunk_figure_refs(page_text)
        for img_idx, img in enumerate(images, start=1):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image['image']
            ext = base_image.get('ext', 'png')
            name = f"{pdf_path.stem}__page{page_number}__img{img_idx}.{ext}".replace(' ', '_')
            out_path = out_dir / name
            out_path.write_bytes(image_bytes)
            manifest.append({
                'page_number': page_number,
                'image_index': img_idx,
                'file_path': str(out_path),
                'caption': caption,
                'figure_refs': figure_refs,
            })
    return manifest


def link_images_to_chunks(chunk_payloads, image_manifest):
    images_by_page = {}
    for img in image_manifest:
        images_by_page.setdefault(img['page_number'], []).append(img)

    enriched = []
    for chunk in chunk_payloads:
        linked_images = []
        seen_paths = set()
        chunk_fig_refs = set(chunk.get('figure_refs', []))
        for page_number in chunk.get('page_numbers', []):
            for img in images_by_page.get(page_number, []):
                match_by_page = True
                img_refs = set(img.get('figure_refs') or [])
                match_by_ref = bool(chunk_fig_refs and img_refs and (chunk_fig_refs & img_refs))
                if match_by_page or match_by_ref:
                    if img['file_path'] not in seen_paths:
                        seen_paths.add(img['file_path'])
                        linked_images.append({
                            'page_number': img['page_number'],
                            'image_index': img['image_index'],
                            'file_path': img['file_path'],
                            'caption': img.get('caption'),
                            'figure_refs': img.get('figure_refs', []),
                            'link_reason': 'page+ref' if match_by_ref else 'page',
                        })
        enriched.append({**chunk, 'linked_images': linked_images})
    return enriched


def inventory(root: Path, output: Path):
    pdfs = list_pdfs(root)
    with output.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['file_name', 'path', 'size_bytes', 'sha256'])
        for p in pdfs:
            w.writerow([p.name, str(p), p.stat().st_size, sha256_file(p)])
    print(f'Inventário gerado: {output} ({len(pdfs)} PDFs)')


def serialize_chunk(chunk, idx: int, linked_images_limit: int | None = 5):
    linked_images = chunk.get('linked_images', [])
    if linked_images_limit is not None:
        linked_images = linked_images[:linked_images_limit]
    return {
        'chunk_index': idx,
        'chars': chunk['chars'],
        'page_start': chunk['page_start'],
        'page_end': chunk['page_end'],
        'page_numbers': chunk['page_numbers'],
        'figure_refs': chunk['figure_refs'],
        'linked_images': linked_images,
        'linked_images_count': len(chunk.get('linked_images', [])),
        'text': chunk['text'],
    }


def pilot(root: Path, limit: int, output_dir: Path, images_dir: Path | None = None, export_full_chunks: bool = False):
    output_dir.mkdir(parents=True, exist_ok=True)
    pdfs = list_pdfs(root)[:limit]
    report = []
    for p in pdfs:
        clean_pages = get_clean_pages(p)
        cleaned = '\n\n'.join(page['text'] for page in clean_pages)
        chunk_payloads = chunk_pages_with_metadata(clean_pages)
        image_manifest = []
        if images_dir:
            image_manifest = extract_images_manifest(p, images_dir / p.stem)
            chunk_payloads = link_images_to_chunks(chunk_payloads, image_manifest)

        chunk_sample = [serialize_chunk(chunk, idx, linked_images_limit=5) for idx, chunk in enumerate(chunk_payloads[:10], start=1)]
        all_chunks = [serialize_chunk(chunk, idx, linked_images_limit=None) for idx, chunk in enumerate(chunk_payloads, start=1)] if export_full_chunks else None

        out = output_dir / f'{p.stem}.json'
        payload = {
            'file_name': p.name,
            'path': str(p),
            'chars': len(cleaned),
            'pages': len(clean_pages),
            'chunks': len(chunk_payloads),
            'images': len(image_manifest),
            'image_manifest_sample': image_manifest[:10],
            'chunk_sample': chunk_sample,
            'all_chunks': all_chunks,
            'stats': {
                'chunks_with_images': sum(1 for chunk in chunk_payloads if chunk.get('linked_images')),
                'chunks_with_figure_refs': sum(1 for chunk in chunk_payloads if chunk.get('figure_refs')),
            },
        }
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        report.append({
            'file_name': p.name,
            'pages': len(clean_pages),
            'chars': len(cleaned),
            'chunks': len(chunk_payloads),
            'images': len(image_manifest),
            'chunks_with_images': payload['stats']['chunks_with_images'],
        })
    print(json.dumps(report, ensure_ascii=False, indent=2))


def ensure_collection(client: QdrantClient, collection_name: str):
    collections = [c.name for c in client.get_collections().collections]
    if collection_name not in collections:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )


def get_openai_client() -> OpenAI:
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY não definido')
    return OpenAI(api_key=api_key)


def get_qdrant_client() -> QdrantClient:
    url = os.getenv('QDRANT_URL')
    api_key = os.getenv('QDRANT_API_KEY')
    if not url:
        raise RuntimeError('QDRANT_URL não definido')
    return QdrantClient(url=url, api_key=api_key)


def embed_texts(client: OpenAI, texts):
    # Batch to stay under OpenAI's 300K token limit per request
    BATCH_SIZE = 100
    all_embeddings = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        resp = client.embeddings.create(model=EMBED_MODEL, input=batch)
        all_embeddings.extend(d.embedding for d in resp.data)
        if len(texts) > BATCH_SIZE:
            print(f'  Embeddings batch {i // BATCH_SIZE + 1}: {len(batch)} texts ({i + len(batch)}/{len(texts)})')
    return all_embeddings


def index_docs(root: Path, limit: int, images_dir: Path | None = None):
    openai_client = get_openai_client()
    qdrant = get_qdrant_client()
    ensure_collection(qdrant, COLLECTION_DEFAULT)

    pdfs = list_pdfs(root)[:limit] if limit else list_pdfs(root)
    total_chunks = 0

    for p in pdfs:
        clean_pages = get_clean_pages(p)
        cleaned = '\n\n'.join(page['text'] for page in clean_pages)
        if len(cleaned) < 200:
            print(f'Pulando {p.name}: texto insuficiente')
            continue

        chunk_payloads = chunk_pages_with_metadata(clean_pages)
        image_manifest = []
        if images_dir:
            image_manifest = extract_images_manifest(p, images_dir / p.stem)
            chunk_payloads = link_images_to_chunks(chunk_payloads, image_manifest)

        vectors = embed_texts(openai_client, [chunk['text'] for chunk in chunk_payloads])
        points = []

        doc_id = str(uuid.uuid4())

        # Infer specialty and document_type from path (raw/{specialty}/{type}/file.pdf)
        path_parts = p.parts
        inferred_specialty = None
        inferred_doc_type = 'book'
        for j, part in enumerate(path_parts):
            if part == 'raw' and j + 1 < len(path_parts):
                inferred_specialty = path_parts[j + 1]
            if part in ('books', 'articles', 'guidelines'):
                inferred_doc_type = part.rstrip('s')  # 'book', 'article', 'guideline'

        for i, (chunk, vector) in enumerate(zip(chunk_payloads, vectors), start=1):
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        'document_id': doc_id,
                        'title': p.stem,
                        'path': str(p),
                        'chunk_index': i,
                        'document_type': inferred_doc_type,
                        'source_tier': 'canonical',
                        'specialty': inferred_specialty,
                        'page_start': chunk['page_start'],
                        'page_end': chunk['page_end'],
                        'page_numbers': chunk['page_numbers'],
                        'figure_refs': chunk['figure_refs'],
                        'image_count': len(chunk.get('linked_images', [])),
                        'image_paths': [img['file_path'] for img in chunk.get('linked_images', [])[:8]],
                        'text': chunk['text'],
                    },
                )
            )

        # Upsert in batches to avoid connection issues with large docs
        UPSERT_BATCH = 200
        for j in range(0, len(points), UPSERT_BATCH):
            batch = points[j:j + UPSERT_BATCH]
            qdrant.upsert(collection_name=COLLECTION_DEFAULT, points=batch)
        total_chunks += len(points)
        print(f'Indexado: {p.name} | chunks={len(points)} | imagens={len(image_manifest)}')

    print(f'Concluído. Total de chunks indexados: {total_chunks}')


def analyze_staging(staging_dir: Path):
    files = sorted(staging_dir.glob('*.json'))
    if not files:
        raise RuntimeError(f'Nenhum JSON encontrado em {staging_dir}')

    summary = []
    total_chunks = 0
    total_images = 0
    total_chunks_with_images = 0
    page_spans = Counter()

    for path in files:
        payload = json.loads(path.read_text(encoding='utf-8'))
        chunk_sample = payload.get('chunk_sample', [])
        chunks_with_images = payload.get('stats', {}).get('chunks_with_images')
        if chunks_with_images is None:
            chunks_with_images = sum(1 for chunk in chunk_sample if chunk.get('linked_images_count', 0) > 0)
        for chunk in chunk_sample:
            page_spans[len(chunk.get('page_numbers', []))] += 1
        summary.append({
            'file_name': payload.get('file_name', path.name),
            'pages': payload.get('pages'),
            'chunks': payload.get('chunks', 0),
            'images': payload.get('images', 0),
            'chunks_with_images': chunks_with_images,
        })
        total_chunks += payload.get('chunks', 0)
        total_images += payload.get('images', 0)
        total_chunks_with_images += chunks_with_images

    report = {
        'staging_dir': str(staging_dir),
        'documents': len(summary),
        'total_chunks': total_chunks,
        'total_images': total_images,
        'total_chunks_with_images': total_chunks_with_images,
        'sample_page_span_distribution': dict(sorted(page_spans.items())),
        'documents_summary': summary,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='cmd', required=True)

    p1 = sub.add_parser('inventory')
    p1.add_argument('--input', required=True)
    p1.add_argument('--output', required=True)

    p2 = sub.add_parser('pilot')
    p2.add_argument('--input', required=True)
    p2.add_argument('--limit', type=int, default=5)
    p2.add_argument('--output-dir', required=True)
    p2.add_argument('--images-dir', required=False)
    p2.add_argument('--export-full-chunks', action='store_true')

    p3 = sub.add_parser('index')
    p3.add_argument('--input', required=True)
    p3.add_argument('--limit', type=int, default=0)
    p3.add_argument('--images-dir', required=False)

    p4 = sub.add_parser('analyze-staging')
    p4.add_argument('--input', required=True)

    args = parser.parse_args()

    if args.cmd == 'inventory':
        inventory(Path(args.input), Path(args.output))
    elif args.cmd == 'pilot':
        pilot(
            Path(args.input),
            args.limit,
            Path(args.output_dir),
            Path(args.images_dir) if args.images_dir else None,
            export_full_chunks=args.export_full_chunks,
        )
    elif args.cmd == 'index':
        index_docs(Path(args.input), args.limit, Path(args.images_dir) if args.images_dir else None)
    elif args.cmd == 'analyze-staging':
        analyze_staging(Path(args.input))


if __name__ == '__main__':
    main()
