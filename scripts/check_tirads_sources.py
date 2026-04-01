#!/usr/bin/env python3
"""Check what the top sources actually say about TI-RADS."""
import json, urllib.request, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Get raw chunks from Qdrant via the health/specialties endpoint to understand the data
# Instead, let's query with just embedding and see raw text

from openai import OpenAI
from qdrant_client import QdrantClient
import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
qdrant = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY"),
)
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")

question = "Qual a classificação TIRADS de um nódulo sólido, hipoecoico, mais largo do que alto, com margem definida e sem calcificações"

embedding = client.embeddings.create(
    input=[question],
    model="text-embedding-3-small",
).data[0].embedding

results = qdrant.query_points(
    collection_name=COLLECTION,
    query=embedding,
    limit=5,
)

for i, hit in enumerate(results.points, 1):
    p = hit.payload
    print(f"=== Fonte {i}: {p.get('title','?')} (p.{p.get('page_start','?')}) score={hit.score:.4f} ===")
    print(p.get("text", "")[:1500])
    print()
