#!/usr/bin/env python3
"""Investigate Q7 and Q8 failures."""
import json, os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
qdrant = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")

questions = {
    "Q7": "Paciente com dispneia aguda, radiografia de torax mostra opacificacao hemitorax direito com desvio mediastinal para esquerda. Qual o diagnostico mais provavel e quais outras hipoteses?",
    "Q8": "O que e o sinal do sulco profundo na radiografia de torax e em que patologia e classicamente visto?",
}

for qid, question in questions.items():
    print(f"\n{'='*70}")
    print(f"{qid}: {question}")
    print(f"{'='*70}")

    embedding = openai_client.embeddings.create(
        input=[question], model="text-embedding-3-small"
    ).data[0].embedding

    results = qdrant.query_points(collection_name=COLLECTION, query=embedding, limit=5)

    for i, hit in enumerate(results.points, 1):
        p = hit.payload
        print(f"\n--- Fonte {i}: {p.get('title','?')} (p.{p.get('page_start','?')}) score={hit.score:.4f} ---")
        print(p.get("text", "")[:1000])
