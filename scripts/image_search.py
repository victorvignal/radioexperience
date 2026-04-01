"""
ARIA Image Search - Test script
Busca imagens similares no Qdrant usando BiomedCLIP.

Uso:
  python scripts/image_search.py --image path/to/image.jpg
"""

import argparse
import base64
import io
import os
import sys
from pathlib import Path

import torch
from PIL import Image
from open_clip import create_model_from_pretrained, get_tokenizer
from qdrant_client import QdrantClient

# ── Config ──
QDRANT_URL = os.getenv("QDRANT_URL", "https://664bcae7-7a94-4933-b917-69d01b830eb4.sa-east-1-0.aws.cloud.qdrant.io")
QDRANT_KEY = os.getenv("QDRANT_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.-tz-MHjwxomKu1Cb5-DjFl1qLi4qsgqa7_JbBveT5Hg")
COLLECTION = "radioexperience_images"


def load_model():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")
    model, preprocess = create_model_from_pretrained(
        'hf-hub:microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224'
    )
    model = model.to(device).eval()
    return model, preprocess, device


def search(image_path: str, top_k: int = 5):
    model, preprocess, device = load_model()
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_KEY)

    # Load and embed query image
    pil_img = Image.open(image_path).convert("RGB")
    img_tensor = preprocess(pil_img).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = model.encode_image(img_tensor)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    query_vec = embedding.cpu().numpy()[0].tolist()

    # Search Qdrant
    results = client.query_points(
        collection_name=COLLECTION,
        query=query_vec,
        limit=top_k,
        with_payload=True,
    )

    print(f"\n{'='*60}")
    print(f"Query: {image_path}")
    print(f"{'='*60}\n")

    for i, hit in enumerate(results.points, 1):
        p = hit.payload
        print(f"#{i} | Score: {hit.score:.4f}")
        print(f"   PDF: {p['pdf_name']}")
        print(f"   Page: {p['page']}")
        print(f"   Specialty: {p['specialty']}")
        print(f"   Size: {p['width']}x{p['height']}")
        print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ARIA Image Search")
    parser.add_argument("--image", required=True, help="Path to query image")
    parser.add_argument("--top-k", type=int, default=5, help="Number of results")
    args = parser.parse_args()
    search(args.image, args.top_k)
