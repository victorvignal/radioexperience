#!/usr/bin/env python3
"""Check what source says about sulco profundo at p.241-244 and p.1653."""
import os
from pathlib import Path
from dotenv import load_dotenv
from qdrant_client import QdrantClient

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)
qdrant = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")

# Search for sulco profundo specifically
from openai import OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
emb = client.embeddings.create(input=["sinal do sulco profundo pneumotorax"], model="text-embedding-3-small").data[0].embedding
results = qdrant.query_points(collection_name=COLLECTION, query=emb, limit=5)

for i, hit in enumerate(results.points, 1):
    p = hit.payload
    title = p.get("title", "?")
    page = p.get("page_start", "?")
    text = p.get("text", "")
    if "sulco" in text.lower() or "profundo" in text.lower():
        print(f"\n=== MATCH: {title} (p.{page}) score={hit.score:.4f} ===")
        # Find and show the context around "sulco profundo"
        idx = text.lower().find("sulco profundo")
        if idx == -1:
            idx = text.lower().find("sulco")
        start = max(0, idx - 100)
        end = min(len(text), idx + 400)
        print(f"...{text[start:end]}...")
