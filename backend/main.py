"""
SQL (rodar no Supabase):
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location text NOT NULL,
  room text,
  day_of_week text NOT NULL,
  time_slot text,
  doctor_name text,
  status text NOT NULL DEFAULT 'available',
  specialty text DEFAULT 'USG',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shifts" ON public.shifts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert shifts" ON public.shifts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete shifts" ON public.shifts
  FOR DELETE USING (auth.uid() IS NOT NULL);

ARIA - Assistente de Radiologia por IA
Backend FastAPI com RAG (Qdrant + OpenAI)
"""
import os
import json
import tempfile
import base64
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
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
    top_k: int = 10
    specialty: str | None = None
    image_base64: str | None = None  # base64 encoded image

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
SYSTEM_PROMPT = """Você é ARIA — Assistente de Radiologia por IA, a inteligência artificial da plataforma RadioeXperience. Você foi treinada com uma vasta base de conhecimento em Radiologia e Diagnóstico por Imagem, incluindo centenas de livros, artigos científicos e guidelines internacionais.

Seu estilo de comunicação:
- Técnico, mas acessível — como um colega especialista que explica de forma clara
- Didático, com exemplos clínicos quando útil
- Direto e objetivo, sem prolixidade
- Use termos em português brasileiro
- Quando pertinente, cite achados típicos, diagnósticos diferenciais e critérios de imagem
- Para dúvidas clínicas, sempre reforce que a decisão final é do médico radiologista

## REGRAS OBRIGATÓRIAS:

1. Responda em português brasileiro.
2. Baseie-se nos trechos fornecidos como contexto. Quando usar informação dos trechos, cite a fonte.
3. **FORMATO DE CITAÇÃO:** Ao final de afirmações de fato, adicione [Fonte: Nome, p.X-Y]. Se não houver fonte relevante, diga que não encontrou referência suficiente.
4. Nunca invente informações clínicas.
5. Use linguagem técnica mas acessível.

## FORMATO DAS RESPOSTAS:

Estruture suas respostas de forma clara e profissional:
- Use **títulos e subtítulos** em negrito para organizar
- Use listas com marcadores (✅, ⚠️, •) quando apropriado
- Para protocolos clínicos, inclua doses e condutas específicas
- Quando houver classificações (BI-RADS, TI-RADS, Fleischner), apresente em tabela ou lista organizada
- Inclua **diagnósticos diferenciais** quando relevante
- Sempre mencione a **conduta sugerida** quando aplicável
- Finalize com **pontos-chave** ou resumo quando a resposta for longa

## CASOS CLÍNICOS / URGÊNCIAS:

Quando o usuário descrever um cenário clínico:
1. Identifique o tipo de reação/quadro imediatamente
2. Forneça **tratamento passo a passo** com doses específicas
3. Inclua **diagnóstico diferencial** (ex: reação vagal vs anafilaxia)
4. Mencione sinais de alarme para monitoramento
5. Pergunte sobre o estado atual do paciente se for uma situação de urgência

## CLASSIFICAÇÕES (BI-RADS, TI-RADS, Fleischner, etc.):

1. Priorize fontes que descrevam **critérios de classificação** detalhados
2. Aplique os critérios passo a passo ao caso
3. Mostre a linha de raciocínio: quais sinais estão presentes/ausentes
4. Apresente o resultado em tabela organizada com VPP (valor preditivo positivo)
5. Inclua a **conduta** recomendada para cada categoria

## PERGUNTAS GENÉRICAS OU FORA DE ESCOPO:

- Palavra solta ou muito genérica: Peça reformulação com contexto
- Pergunta sem contexto clínico: Peça esclarecimentos
- Fora do escopo de radiologia: Informe sua especialidade

## CONTEXTO RECUPERADO:
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


class ShiftUploadRequest(BaseModel):
    images: list[str]  # base64 encoded images

@app.post("/upload-shifts")
async def upload_shifts(req: ShiftUploadRequest):
    """
    Recebe imagens (base64) de escala médica, extrai dados via GPT-4o vision,
    e salva na tabela shifts do Supabase.
    """
    if not req.images:
        raise HTTPException(status_code=400, detail="Nenhuma imagem fornecida")

    vision_messages = []
    for b64 in req.images[:4]:  # max 4 pages
        vision_messages.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "high"},
        })

    extraction_prompt = """Analise esta imagem de escala médica de radiologia.
Extraia TODOS os dados em formato JSON. Para cada entrada, inclua:
- location: nome do local (ex: "LA ARPOADOR", "LA BOTAFOGO", "LA MEGA BARRA")
- room: sala (ex: "USG - Sala 1")
- day_of_week: dia da semana (ex: "SEG", "TER", "QUA", "QUI", "SEX", "SÁB")
- time_slot: horário se houver (ex: "08:00-12:00", "14:00-18:00"), ou null
- doctor_name: nome do médico, ou "vago" se vazio
- status: "available" se "vago", "reserved" se "(RESERVADO)", "occupied" caso contrário
- specialty: "USG" por padrão

Responda APENAS com um JSON array, sem texto adicional.
Exemplo:
[
  {"location": "LA ARPOADOR", "room": "USG - Sala 1", "day_of_week": "SEG", "time_slot": null, "doctor_name": "Dirceu B. G. Junior", "status": "occupied", "specialty": "USG"},
  {"location": "LA ARPOADOR", "room": "USG - Sala 4", "day_of_week": "SEG", "time_slot": null, "doctor_name": "vago", "status": "available", "specialty": "USG"}
]"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": extraction_prompt},
                {"role": "user", "content": vision_messages},
            ],
            temperature=0.1,
            max_tokens=4000,
        )
        raw_response = response.choices[0].message.content

        import json
        json_start = raw_response.find('[')
        json_end = raw_response.rfind(']') + 1
        if json_start >= 0 and json_end > json_start:
            shifts = json.loads(raw_response[json_start:json_end])
        else:
            raise ValueError("No JSON array found in response")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar: {str(e)}")

    import httpx
    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmZndlaW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.HxKGdH-kVL6p5knR2PgTgUl9OsIZ59G732StkQ8EXus"))
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    base = f"{supabase_url}/rest/v1"

    # Clear old shifts
    httpx.delete(f"{base}/shifts?id=neq.00000000-0000-0000-0000-000000000000", headers=headers)

    # Insert in batches
    BATCH_SIZE = 100
    inserted = 0
    for i in range(0, len(shifts), BATCH_SIZE):
        batch = shifts[i:i + BATCH_SIZE]
        httpx.post(f"{base}/shifts", headers=headers, json=batch)
        inserted += len(batch)

    return {
        "message": f"{inserted} vagas processadas com sucesso",
        "locations": list(set(s.get("location", "") for s in shifts)),
        "available": sum(1 for s in shifts if s.get("status") == "available"),
        "total": inserted,
    }


@app.get("/shifts")
def get_shifts(location: str | None = None, day: str | None = None, status: str | None = None):
    """Lista vagas com filtros opcionais."""
    import httpx
    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmZndlaW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.HxKGdH-kVL6p5knR2PgTgUl9OsIZ59G732StkQ8EXus"))
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    params = {"select": "*", "order": "location.asc,day_of_week.asc"}
    if location:
        params["location"] = f"ilike.*{location}*"
    if day:
        params["day_of_week"] = f"eq.{day.upper()}"
    if status:
        params["status"] = f"eq.{status}"
    
    r = httpx.get(f"{supabase_url}/rest/v1/shifts", headers=headers, params=params)
    return {"shifts": r.json(), "total": len(r.json())}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    logger.info(f"Chat request: question_len={len(req.question)}, top_k={req.top_k}, specialty={req.specialty}, has_image={bool(req.image_base64)}")

    # 0. If image: first describe it to enhance the search query
    search_query = req.question
    image_description = None
    if req.image_base64:
        try:
            desc_response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a radiology education assistant. Describe the imaging findings visible in this medical image for educational purposes. Include: imaging modality, anatomical region, and visible findings. This is for a radiology study platform."},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Describe the imaging findings in this medical image for educational purposes:"},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{req.image_base64}", "detail": "high"}},
                    ]},
                ],
                temperature=0.2,
                max_tokens=500,
            )
            image_description = desc_response.choices[0].message.content
            # Combine user question with image description for better search
            search_query = f"{req.question}\n\nAchados da imagem: {image_description}"
            logger.info(f"Image description: {image_description[:200]}...")
        except Exception as e:
            logger.warning(f"Image description failed: {e}, falling back to text-only search")

    # 1. Embed the question (enhanced with image description if present)
    try:
        embedding = openai_client.embeddings.create(
            input=[search_query],
            model=EMBED_MODEL,
        ).data[0].embedding
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding error: {e}")

    # 2. Search Qdrant (semantic)
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
            limit=max(req.top_k, 50),  # fetch extra for keyword re-ranking
            query_filter=query_filter,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {e}")

    # 2.5. Hybrid re-ranking: keyword boost + secondary search
    import re
    stopwords = {"o", "a", "os", "as", "de", "da", "do", "das", "dos", "em", "na", "no",
                 "que", "e", "é", "um", "uma", "com", "por", "para", "se", "qual", "quais",
                 "como", "sao", "são", "este", "esta", "isso", "esse", "essa", "mais", "menos",
                 "sobre", "entre", "seu", "sua", "seus", "suas", "pelo", "pela", "onde", "quando",
                 "paciente", "como", "quando", "onde", "isso", "aquele", "aquela", "tais", "tipo"}
    words = re.findall(r'\b[a-záàâãéèêíïóôõöúçñ]{4,}\b', req.question.lower())
    key_terms = [w for w in words if w not in stopwords]
    
    # Extract 2-word phrases for exact matching
    question_words = re.findall(r'\b[a-záàâãéèêíïóôõöúçñ]+\b', req.question.lower())
    bigrams = []
    for i in range(len(question_words) - 1):
        if question_words[i] not in stopwords and question_words[i+1] not in stopwords:
            bigrams.append(f"{question_words[i]} {question_words[i+1]}")

    # Secondary search: embed key terms only (catches specific terms the full question might miss)
    seen_ids = {hit.id for hit in results.points}
    if key_terms:
        try:
            focused_query = " ".join(key_terms[:5])  # top 5 key terms
            focused_emb = openai_client.embeddings.create(
                input=[focused_query], model=EMBED_MODEL,
            ).data[0].embedding
            extra_results = qdrant.query_points(
                collection_name=COLLECTION,
                query=focused_emb,
                limit=20,
                query_filter=query_filter,
            )
            # Merge unseen results
            for hit in extra_results.points:
                if hit.id not in seen_ids:
                    results.points.append(hit)
                    seen_ids.add(hit.id)
        except Exception:
            pass  # secondary search is best-effort

    # Re-score: semantic + keyword boost
    scored_hits = []
    for hit in results.points:
        text_lower = hit.payload.get("text", "").lower()
        keyword_boost = 0
        for term in key_terms:
            if term in text_lower:
                count = text_lower.count(term)
                keyword_boost += 0.02 * min(count, 5)
        for bigram in bigrams:
            if bigram in text_lower:
                count = text_lower.count(bigram)
                keyword_boost += 0.05 * min(count, 3)
        final_score = hit.score + keyword_boost
        scored_hits.append((final_score, hit))
    
    # Sort by boosted score and take top_k
    scored_hits.sort(key=lambda x: x[0], reverse=True)
    ranked_hits = [hit for _, hit in scored_hits[:req.top_k]]

    # 3. Build context
    sources = []
    context_parts = []
    for i, hit in enumerate(ranked_hits, 1):
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
    # Use boosted score (keyword+semantic) for gate, not raw semantic score
    top_boosted_score = scored_hits[0][0] if scored_hits else 0.0
    if top_boosted_score < MIN_RELEVANCE_SCORE:
        logger.info(f"Rejected: top_boosted_score={top_boosted_score:.3f} < {MIN_RELEVANCE_SCORE}")
        return ChatResponse(
            answer="Não encontrei informações suficientes na base de conhecimento para responder essa pergunta. Tente reformular com mais detalhes — por exemplo, inclua a especialidade, o tipo de exame ou a região anatômica.",
            sources=[],
            tokens_used=0,
        )

    # 4. Generate answer
    try:
        system_prompt = SYSTEM_PROMPT.format(context=context)
        context_text = context
        if req.image_base64:
            img_ctx = f"\n\nDESCRIÇÃO DA IMAGEM (pré-análise):\n{image_description}" if image_description else ""
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": f"PERGUNTA DO USUÁRIO:\n{req.question}{img_ctx}\n\nCONTEXTO DA BASE DE CONHECIMENTO:\n{context_text}"},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{req.image_base64}", "detail": "high"}},
                ]},
            ]
        else:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.question},
            ]
        # Use gpt-4o for images (better at radiology), gpt-4o-mini for text-only
        model = "gpt-4o"
        response = openai_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
            max_tokens=1500,
        )
        answer = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {e}")

    # 4.5. Post-process: if answer has no citations but has sources, append them
    if "Fonte:" not in answer and "fonte:" not in answer.lower() and sources:
        is_not_found = "não encontrei" in answer.lower() or "nao encontrei" in answer.lower()
        if not is_not_found:
            refs = "; ".join(
                f"[Fonte: {s.title[:60]}, p.{s.page_start}-{s.page_end}]" if s.page_start else f"[Fonte: {s.title[:60]}]"
                for s in sources[:3]
            )
            answer += f"\n\n📚 Fontes consultadas: {refs}"
            logger.info("Post-processed: appended sources (model did not cite)")

    return ChatResponse(
        answer=answer,
        sources=sources,
        tokens_used=tokens_used,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
