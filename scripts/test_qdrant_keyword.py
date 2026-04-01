#!/usr/bin/env python3
"""Test Qdrant keyword search capability."""
import os
from pathlib import Path
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, MatchText, Filter

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)
qdrant = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")

# Try keyword search using scroll with text filter
try:
    result, _ = qdrant.scroll(
        collection_name=COLLECTION,
        scroll_filter=Filter(
            must=[FieldCondition(key="text", match=MatchText(text="sulco profundo"))]
        ),
        limit=5,
        with_payload=["title", "page_start"],
    )
    print(f"Found {len(result)} results with MatchText")
    for p in result:
        print(f"  {p.payload.get('title','?')} (p.{p.payload.get('page_start','?')})")
except Exception as e:
    print(f"MatchText not available: {e}")
    # Try alternative: full text search
    print("\nTrying alternative approaches...")
