import io
import json
import argparse
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image


def sanitize(name: str) -> str:
    return ''.join(c if c.isalnum() or c in ('-', '_') else '_' for c in name)


def extract_images_from_pdf(pdf_path: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    manifest = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        images = page.get_images(full=True)
        for img_idx, img in enumerate(images, start=1):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image['image']
            ext = base_image.get('ext', 'png')
            name = f"{sanitize(pdf_path.stem)}__page{page_index+1}__img{img_idx}.{ext}"
            out_path = out_dir / name
            out_path.write_bytes(image_bytes)
            manifest.append({
                'document': pdf_path.name,
                'page_number': page_index + 1,
                'image_index': img_idx,
                'file_path': str(out_path),
                'ext': ext,
            })
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--manifest', required=True)
    args = parser.parse_args()

    pdf_path = Path(args.input)
    out_dir = Path(args.output_dir)
    manifest = extract_images_from_pdf(pdf_path, out_dir)
    Path(args.manifest).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Extraídas {len(manifest)} imagens de {pdf_path.name}')


if __name__ == '__main__':
    main()
