"""
ARIA - Assistente de Radiologia por IA
Backend FastAPI com RAG (Qdrant + OpenAI)
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aria")

# Load env from parent directory
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# ── Clients ──
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
qdrant = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY"),
)
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
MIN_RELEVANCE_SCORE = float(os.getenv("MIN_RELEVANCE_SCORE", "0.55"))

# ── App ──
app = FastAPI(title="ARIA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://victorvignal.github.io",
        "https://victorvignal.me",
        "https://www.victorvignal.me",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4173",
    ],
    allow_origin_regex=r"https://.*\.(github\.io|railway\.app|vercel\.app|vercel\.co|netlify\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──
class ChatRequest(BaseModel):
    question: str
    top_k: int = 7
    specialty: str | None = None

    def validate_question(self):
        if not self.question or not self.question.strip():
            raise ValueError("Question cannot be empty")
        if len(self.question) > 2000:
            raise ValueError("Question too long (max 2000 characters)")
        if self.top_k < 1 or self.top_k > 20:
            raise ValueError("top_k must be between 1 and 20")

class Source(BaseModel):
    title: str
    page_start: int | None = None
    page_end: int | None = None
    score: float
    excerpt: str

class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    tokens_used: int

# ── System Prompt ──
SYSTEM_PROMPT = """Você é ARIA, um assistente de inteligência artificial especializado em radiologia e diagnóstico por imagem.

Diretrizes:
1. Responda em português brasileiro.
2. Baseie-se EXCLUSIVAMENTE nos trechos fornecidos como contexto.
3. **OBRIGATÓRIO:** Cite as fontes SEMPRE no formato [Fonte: Título, p. X-Y] ao final de CADA afirmação factual ou parágrafo. Nunca omita citações — mesmo que a resposta seja curta. Se citar múltiplas fontes para a mesma afirmação, separe por ponto-e-vírgula.
4. Se o contexto não for suficiente, diga claramente: "Não encontrei informações suficientes na base de conhecimento para responder essa pergunta."
5. Nunca invente informações clínicas.
6. Use linguagem técnica mas acessível.
7. Quando relevante, mencione imagens clínicas referenciadas nos documentos.
8. Ao descrever achados de imagem (sinais radiológicos, padrões, etc.), cite o texto exato ou parafraseie com indicação precisa da fonte e página.

## Classificações e escalas (BI-RADS, TI-RADS, etc.)

Quando a pergunta envolver classificar um caso clínico em uma escala (BI-RADS, TI-RADS, Fleischner, etc.):

1. **Priorize fontes que descrevam CRITÉRIOS DE CLASSIFICAÇÃO** (tabelas com sinais, pontos, categorias) sobre fontes que apenas LISTAM as categorias genéricas.
2. **Aplique os critérios passo a passo** ao caso descrito pelo usuário: identifique cada achado mencionado, verifique se é sinal de suspeição ou não, some/resevalie, e então classifique.
3. **Não pule etapas.** Mostre sua linha de raciocínio: quais sinais estão presentes, quais estão ausentes, e como isso se traduz na classificação final.
4. Se os critérios exatos não estiverem no contexto, diga que não encontrou os critérios suficientes.

## Detecção de perguntas inadequadas

Antes de responder, avalie se a pergunta do usuário é clara e específica o suficiente para radiologia/diagnóstico por imagem:

- **Palavra solta ou muito genérica** (ex: "mama", "dor", "osso"): Peça ao usuário para reformular com mais contexto. Exemplo: "Sua pergunta é muito genérica. Pode reformular? Por exemplo: 'Quais são os achados mamográficos do BI-RADS 4?'"
- **Pergunta sem contexto** (ex: "isso é grave?", "tá normal?"): Peça esclarecimentos sobre qual exame, região ou achado o usuário se refere.
- **Fora do escopo de radiologia**: Informe que sua especialidade é radiologia e diagnóstico por imagem.

Se a pergunta for clara e pertinente, responda normalmente.

Contexto recuperado:
{context}"""


# ── Routes ──
@app.get("/health")
def health():
    try:
        cols = qdrant.get_collections()
        count = qdrant.count(collection_name=COLLECTION).count
        return {
            "status": "ok",
            "collection": COLLECTION,
            "documents_indexed": count,
            "collections": [c.name for c in cols.collections],
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@app.get("/specialties")
def list_specialties():
    """List available specialties with approximate chunk counts (sampled)."""
    try:
        result, _ = qdrant.scroll(
            collection_name=COLLECTION,
            limit=5000,
            with_payload=["specialty"],
        )
        from collections import Counter
        counts = Counter(
            p.payload.get("specialty", "unknown") for p in result
        )
        # Scale estimates to full collection
        total = qdrant.count(collection_name=COLLECTION).count
        scale = total / len(result) if result else 1
        specialties = {
            spec: int(count * scale)
            for spec, count in counts.most_common()
            if spec and spec not in ("unknown", "_duplicates")
        }
        return {"specialties": specialties, "total": total, "sampled": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    logger.info(f"Chat request: question_len={len(req.question)}, top_k={req.top_k}, specialty={req.specialty}")
    # 1. Embed the question
    try:
        embedding = openai_client.embeddings.create(
            input=[req.question],
            model=EMBED_MODEL,
        ).data[0].embedding
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding error: {e}")

    # 2. Search Qdrant
    query_filter = None
    if req.specialty:
        from qdrant_client.models import FieldCondition, MatchValue, Filter
        query_filter = Filter(
            must=[FieldCondition(key="specialty", match=MatchValue(value=req.specialty))]
        )

    try:
        results = qdrant.query_points(
            collection_name=COLLECTION,
            query=embedding,
            limit=req.top_k,
            query_filter=query_filter,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {e}")

    # 3. Build context
    sources = []
    context_parts = []
    for i, hit in enumerate(results.points, 1):
        p = hit.payload
        excerpt = p.get("text", "")[:800]
        title = p.get("title", "Desconhecido")
        page_start = p.get("page_start")
        page_end = p.get("page_end")

        context_parts.append(
            f"[Fonte {i}: {title}, p.{page_start}-{page_end}]\n{excerpt}"
        )
        sources.append(Source(
            title=title,
            page_start=page_start,
            page_end=page_end,
            score=round(hit.score, 4),
            excerpt=excerpt[:300],
        ))

    context = "\n\n---\n\n".join(context_parts)

    # 3.5. Score gate: reject if top result is below threshold
    top_score = sources[0].score if sources else 0.0
    if top_score < MIN_RELEVANCE_SCORE:
        logger.info(f"Rejected: top_score={top_score:.3f} < {MIN_RELEVANCE_SCORE}")
        return ChatResponse(
            answer="Não encontrei informações suficientes na base de conhecimento para responder essa pergunta. Tente reformular com mais detalhes — por exemplo, inclua a especialidade, o tipo de exame ou a região anatômica.",
            sources=[],
            tokens_used=0,
        )

    # 4. Generate answer
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT.format(context=context)},
                {"role": "user", "content": req.question},
            ],
            temperature=0.3,
            max_tokens=1500,
        )
        answer = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {e}")

    return ChatResponse(
        answer=answer,
        sources=sources,
        tokens_used=tokens_used,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
