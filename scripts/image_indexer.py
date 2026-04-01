"""
ARIA Image Embedding Pipeline
Extrai imagens dos PDFs, gera BiomedCLIP embeddings e salva no Qdrant.
Rode no PC com GPU (NVIDIA + CUDA).

Uso:
  pip install open_clip_torch torch torchvision pymupdf qdrant-client pillow tqdm
  python scripts/image_indexer.py --subset 2
"""

import argparse
import base64
import io
import os
import sys
from pathlib import Path
from tqdm import tqdm

import fitz  # PyMuPDF
import torch
from PIL import Image
from open_clip import create_model_from_pretrained, get_tokenizer
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

# ── Config ──
QDRANT_URL = os.getenv("QDRANT_URL", "https://664bcae7-7a94-4933-b917-69d01b830eb4.sa-east-1-0.aws.cloud.qdrant.io")
QDRANT_KEY = os.getenv("QDRANT_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.-tz-MHjwxomKu1Cb5-DjFl1qLi4qsgqa7_JbBveT5Hg")
COLLECTION = "radioexperience_images"
RAW_DIR = Path(__file__).parent.parent.parent / "RadioeXperienceRAG" / "raw"
EMBED_DIM = 512  # BiomedCLIP embedding dimension
MIN_IMAGE_SIZE = 100  # skip tiny images (icons, logos)


def load_model():
    """Load BiomedCLIP model."""
    print("Loading BiomedCLIP model...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")
    if device == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB")

    model, preprocess = create_model_from_pretrained(
        'hf-hub:microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224'
    )
    model = model.to(device)
    model.eval()
    return model, preprocess, device


def extract_images_from_pdf(pdf_path: Path, specialty: str):
    """Extract images from a PDF with page references."""
    images = []
    try:
        doc = fitz.open(str(pdf_path))
        for page_num in range(len(doc)):
            page = doc[page_num]
            image_list = page.get_images(full=True)
            for img_idx, img_info in enumerate(image_list):
                try:
                    xref = img_info[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image.get("ext", "png")

                    # Open with PIL to validate and resize
                    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                    w, h = pil_img.size

                    # Skip tiny images (icons, logos, etc.)
                    if w < MIN_IMAGE_SIZE or h < MIN_IMAGE_SIZE:
                        continue

                    images.append({
                        "image": pil_img,
                        "pdf_name": pdf_path.stem,
                        "page": page_num + 1,
                        "specialty": specialty,
                        "width": w,
                        "height": h,
                        "format": image_ext,
                    })
                except Exception:
                    continue
        doc.close()
    except Exception as e:
        print(f"  Error opening {pdf_path.name}: {e}")
    return images


def generate_embedding(model, preprocess, device, pil_image):
    """Generate BiomedCLIP embedding for an image."""
    # Resize to 224x224 (BiomedCLIP input size)
    img_tensor = preprocess(pil_image).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = model.encode_image(img_tensor)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)  # normalize
    return embedding.cpu().numpy()[0].tolist()


def setup_qdrant():
    """Create collection if not exists."""
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_KEY)
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION not in collections:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )
        print(f"Created collection: {COLLECTION}")
    else:
        count = client.count(collection_name=COLLECTION).count
        print(f"Collection {COLLECTION} exists with {count} points")
    return client


def process_pdfs(subset_count: int = 0):
    """Main pipeline: extract images -> embed -> upload."""
    model, preprocess, device = load_model()
    client = setup_qdrant()

    # Find all PDFs organized by specialty
    pdf_files = []
    for specialty_dir in sorted(RAW_DIR.iterdir()):
        if not specialty_dir.is_dir() or specialty_dir.name.startswith("_"):
            continue
        specialty = specialty_dir.name
        for pdf in specialty_dir.glob("**/*.pdf"):
            pdf_files.append((pdf, specialty))

    if subset_count > 0:
        pdf_files = pdf_files[:subset_count]
        print(f"Processing subset: {subset_count} PDFs")
    else:
        print(f"Processing all {len(pdf_files)} PDFs")

    total_images = 0
    total_embedded = 0
    batch = []
    BATCH_SIZE = 50

    for pdf_path, specialty in tqdm(pdf_files, desc="PDFs"):
        print(f"\n  {pdf_path.name} ({specialty})")
        images = extract_images_from_pdf(pdf_path, specialty)
        print(f"  Found {len(images)} images")

        for img_data in tqdm(images, desc="  Embedding", leave=False):
            try:
                embedding = generate_embedding(model, preprocess, device, img_data["image"])

                point = PointStruct(
                    id=total_embedded,
                    vector=embedding,
                    payload={
                        "pdf_name": img_data["pdf_name"],
                        "page": img_data["page"],
                        "specialty": img_data["specialty"],
                        "width": img_data["width"],
                        "height": img_data["height"],
                    },
                )
                batch.append(point)
                total_embedded += 1
                total_images += 1

                # Upload in batches
                if len(batch) >= BATCH_SIZE:
                    client.upsert(collection_name=COLLECTION, points=batch)
                    batch = []
                    print(f"    Uploaded {total_embedded} images so far")

            except Exception as e:
                print(f"    Error embedding image: {e}")
                continue

    # Upload remaining
    if batch:
        client.upsert(collection_name=COLLECTION, points=batch)

    print(f"\nDone! Total images embedded: {total_embedded}")
    print(f"Collection: {COLLECTION}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ARIA Image Embedding Pipeline")
    parser.add_argument("--subset", type=int, default=0,
                        help="Process only N PDFs (0 = all)")
    args = parser.parse_args()

    process_pdfs(args.subset)
