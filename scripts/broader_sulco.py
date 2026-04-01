#!/usr/bin/env python3
"""Broader search for sulco profundo."""
import os
from pathlib import Path
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from openai import OpenAI

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)
qdrant = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Try the exact question
emb = client.embeddings.create(input=["O que e o sinal do sulco profundo na radiografia de torax"], model="text-embedding-3-small").data[0].embedding
results = qdrant.query_points(collection_name=COLLECTION, query=emb, limit=10)

for i, hit in enumerate(results.points, 1):
    p = hit.payload
    title = p.get("title", "?")
    page = p.get("page_start", "?")
    text = p.get("text", "").lower()
    has_sulco = "sulco" in text
    print(f"{i}. {title[:50]} (p.{page}) score={hit.score:.4f} sulco={'YES' if has_sulco else 'no'}")
