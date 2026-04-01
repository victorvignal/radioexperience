#!/usr/bin/env python3
"""Check if the sulco profundo definition is actually in the collection at p.1653."""
import os
from pathlib import Path
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, MatchValue, Filter

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)
qdrant = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")

# Scroll through and find chunks with "sulco profundo"
result, _ = qdrant.scroll(
    collection_name=COLLECTION,
    limit=50000,
    with_payload=["text", "title", "page_start"],
)

found = 0
for p in result:
    text = p.payload.get("text", "").lower()
    if "sulco profundo" in text:
        found += 1
        title = p.payload.get("title", "?")
        page = p.payload.get("page_start", "?")
        idx = text.find("sulco profundo")
        start = max(0, idx - 100)
        end = min(len(text), idx + 300)
        print(f"\nFOUND #{found}: {title} (p.{page})")
        print(f"...{p.payload['text'][start:end]}...")
        
print(f"\nTotal chunks with 'sulco profundo': {found}")
