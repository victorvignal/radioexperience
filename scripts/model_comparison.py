"""
Compare ARIA responses across different models.
Uses the RAG context from Qdrant + different models for generation.
"""
import os
import time
import json
from openai import OpenAI
from qdrant_client import QdrantClient

# Config
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "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")
QDRANT_URL = "https://664bcae7-7a94-4933-b917-69d01b830eb4.sa-east-1-0.aws.cloud.qdrant.io"
QDRANT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.-tz-MHjwxomKu1Cb5-DjFl1qLi4qsgqa7_JbBveT5Hg"
EMBED_MODEL = "text-embedding-3-small"

oai = OpenAI(api_key=OPENAI_KEY)
qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_KEY)

MODELS = ["gpt-4o", "gpt-4.1", "o4-mini", "gpt-4o-mini"]

QUESTIONS = [
    "O que é BI-RADS?",
    "Quais são os critérios de TI-RADS?",
    "O que é adenomiomatose da vesícula?",
    "Quais são os achados de pneumotórax na radiografia de tórax?",
    "O que é o sinal do sulco profundo?",
]

SYSTEM_PROMPT = """Você é ARIA, assistente de radiologia. Responda em português brasileiro.
Use os trechos fornecidos como contexto. Cite as fontes ao final de cada afirmação.
Se não encontrar informação suficiente, diga. Use linguagem técnica mas acessível."""


def get_context(question):
    """Get RAG context for a question."""
    emb = oai.embeddings.create(input=[question], model=EMBED_MODEL).data[0].embedding
    results = qdrant.query_points(collection_name="radioexperience_knowledge", query=emb, limit=5)
    context_parts = []
    sources = []
    for hit in results.points:
        p = hit.payload
        title = p.get("title", "?")
        text = p.get("text", "")[:600]
        page = p.get("page_start", "?")
        context_parts.append(f"[Fonte: {title}, p.{page}]\n{text}")
        sources.append(f"{title[:40]} (p.{page})")
    return "\n\n---\n\n".join(context_parts), sources


def ask_model(model, question, context):
    """Ask a model with RAG context."""
    try:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT.format(context=context) if "{context}" in SYSTEM_PROMPT else SYSTEM_PROMPT + f"\n\nContexto:\n{context}"},
            {"role": "user", "content": question},
        ]
        start = time.time()
        r = oai.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
            max_tokens=800,
        )
        elapsed = time.time() - start
        answer = r.choices[0].message.content
        tokens = r.usage.total_tokens if r.usage else 0
        return answer[:400], elapsed, tokens
    except Exception as e:
        return f"ERRO: {str(e)[:100]}", 0, 0


def main():
    print("=" * 80)
    print("ARIA Model Comparison Test")
    print("=" * 80 + "\n")

    for q in QUESTIONS:
        print("\n" + "-" * 80)
        print(f"PERGUNTA: {q}")
        print("-" * 80)

        context, sources = get_context(q)
        print(f"Fontes: {', '.join(sources[:3])}\n")

        for model in MODELS:
            answer, elapsed, tokens = ask_model(model, q, context)
            cost = (tokens / 1_000_000) * 5
            print(f"\n-- {model} ({elapsed:.1f}s, ~${cost:.4f}) --")
            print(answer)
        
        print()


if __name__ == "__main__":
    main()
