#!/usr/bin/env python3
"""Debug hybrid search for sulco profundo."""
import os, re
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
qdrant = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")

question = "O que e o sinal do sulco profundo na radiografia de torax e em que patologia e classicamente visto?"

# Primary search
emb = client.embeddings.create(input=[question], model="text-embedding-3-small").data[0].embedding
results = qdrant.query_points(collection_name=COLLECTION, query=emb, limit=50)

print(f"Primary search: {len(results.points)} results")

# Check if sulco profundo chunks are in the results
target_pages = [1906, 274]
for hit in results.points:
    page = hit.payload.get("page_start")
    text = hit.payload.get("text", "").lower()
    if page in target_pages or "sulco profundo" in text:
        print(f"  FOUND in primary: p.{page} score={hit.score:.4f}")

# Secondary search
stopwords = {"o", "a", "os", "as", "de", "da", "do", "das", "dos", "em", "na", "no",
             "que", "e", "é", "um", "uma", "com", "por", "para", "se", "qual", "quais",
             "como", "sao", "são", "este", "esta", "isso", "esse", "essa", "mais", "menos",
             "sobre", "entre", "seu", "sua", "seus", "suas", "pelo", "pela", "onde", "quando",
             "paciente", "tais", "tipo"}
words = re.findall(r'\b[a-záàâãéèêíïóôõöúçñ]{4,}\b', question.lower())
key_terms = [w for w in words if w not in stopwords]
focused_query = " ".join(key_terms[:5])
print(f"\nFocused query: '{focused_query}'")

focused_emb = client.embeddings.create(input=[focused_query], model="text-embedding-3-small").data[0].embedding
extra = qdrant.query_points(collection_name=COLLECTION, query=focused_emb, limit=20)

print(f"Secondary search: {len(extra.points)} results")
for hit in extra.points:
    page = hit.payload.get("page_start")
    text = hit.payload.get("text", "").lower()
    if page in target_pages or "sulco profundo" in text:
        print(f"  FOUND in secondary: p.{page} score={hit.score:.4f}")

# Check all IDs from both
all_ids = {hit.id for hit in results.points} | {hit.id for hit in extra.points}
print(f"\nTotal unique candidates: {len(all_ids)}")

# Now do the keyword boosting on all candidates
all_hits = list(results.points) + [h for h in extra.points if h.id not in {hit.id for hit in results.points}]
bigrams = []
for i in range(len(words) - 1):
    if words[i] not in stopwords and words[i+1] not in stopwords:
        bigrams.append(f"{words[i]} {words[i+1]}")

print(f"Key terms: {key_terms}")
print(f"Bigrams: {bigrams}")

scored = []
for hit in all_hits:
    text_lower = hit.payload.get("text", "").lower()
    boost = 0
    for term in key_terms:
        if term in text_lower:
            boost += 0.02 * min(text_lower.count(term), 5)
    for bigram in bigrams:
        if bigram in text_lower:
            boost += 0.05 * min(text_lower.count(bigram), 3)
    scored.append((hit.score + boost, boost, hit))

scored.sort(key=lambda x: x[0], reverse=True)

print(f"\nTop 15 after boosting:")
for i, (final, boost, hit) in enumerate(scored[:15], 1):
    page = hit.payload.get("page_start")
    text = hit.payload.get("text", "").lower()
    has_sulco = "sulco profundo" in text
    print(f"  {i}. p.{page} sem={hit.score:.4f} boost={boost:.4f} final={final:.4f} sulco={'YES' if has_sulco else 'no'}")
