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
  batch_id text,
  source_file text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Se a tabela já existe, adicione as colunas:
-- ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS batch_id text;
-- ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS source_file text;

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
import asyncio
import json
import tempfile
import base64
import io
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from starlette.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
import logging
import json
import uuid
import httpx
import random
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from contextlib import asynccontextmanager

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])

# ── Structured Logging ───────────────────────────────────────────────────────
class StructuredLogger:
    def __init__(self, name):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)

    def _format(self, level, msg, **kwargs):
        return {
            "level": level,
            "msg": msg,
            "service": "aria-backend",
            "time": datetime.now(timezone.utc).isoformat(),
            **kwargs,
        }

    def info(self, msg, **kwargs):
        self.logger.info(json.dumps(self._format("info", msg, **kwargs)))

    def warning(self, msg, **kwargs):
        self.logger.warning(json.dumps(self._format("warning", msg, **kwargs)))

    def error(self, msg, **kwargs):
        self.logger.error(json.dumps(self._format("error", msg, **kwargs)))

    def debug(self, msg, **kwargs):
        self.logger.debug(json.dumps(self._format("debug", msg, **kwargs)))

logger = StructuredLogger("aria")

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

# ── Shared async HTTP client ──────────────────────────────────────────────────
_http_client: httpx.AsyncClient | None = None

async def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
    return _http_client


# ── Lifespan: startup/shutdown ────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("ARIA backend starting", version="1.1.0")
    try:
        openai_client.models.list()
        logger.info("OpenAI API: ok")
    except Exception as e:
        logger.error(f"OpenAI API verification failed: {e}")
    try:
        qdrant.get_collections()
        logger.info("Qdrant: ok")
    except Exception as e:
        logger.error(f"Qdrant connection failed: {e}")
    yield
    # Shutdown: close HTTP client
    if _http_client:
        await _http_client.aclose()
        _http_client = None
    logger.info("ARIA backend shutdown complete")


def search_similar_images(image_b64, top_k=5):
    """Busca imagens similares no Qdrant via BiomedCLIP (HF Inference API)."""
    # Send image to HF Inference API for embedding
    try:
        img_bytes = base64.b64decode(image_b64)
        hf_response = httpx.post(
            "https://api-inference.huggingface.co/models/microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224",
            headers={"Content-Type": "application/octet-stream"},
            content=img_bytes,
            timeout=30,
        )
        embedding = hf_response.json()
        if not isinstance(embedding, list) or len(embedding) != 512:
            logger.warning(f"HF API returned unexpected embedding shape")
            return "", []
    except Exception as e:
        logger.warning(f"HF Inference API failed: {e}")
        return "", []

    # Search Qdrant
    results = qdrant.query_points(
        collection_name="radioexperience_images",
        query=embedding,
        limit=top_k,
        with_payload=True,
    )

    context_parts = []
    sources = []
    for hit in results.points:
        p = hit.payload or {}
        pdf_name = p.get("pdf_name", "")
        page = p.get("page", 0)
        context_parts.append(f"[Fonte: {pdf_name}, p.{page}] Imagem similar encontrada (score: {hit.score:.2f})")
        sources.append({"title": pdf_name, "page": page, "score": hit.score})

    return "\n\n---\n\n".join(context_parts[:5]), sources[:5]


# ── App ──
app = FastAPI(title="ARIA API", version="1.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://victorvignal.github.io",
        "https://victorvignal.me",
        "https://www.victorvignal.me",
        "https://radioexperience.com.br",
        "https://www.radioexperience.com.br",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4173",
    ],
    # Regex curinga removido — apenas origens explícitas
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Identity shortcuts: answer without RAG ─────────────────────────────────
IDENTITY_QUESTIONS = {
    "quem é você", "quem eh voce", "who are you", "what is your name",
    "what's your name", "who r u", "vc e quem", "voce e quem", "aria quem",
    "introduza-se", "introduz-se", "tell me about yourself", "about you",
}

def _is_identity_question(q: str) -> bool:
    """Return True if the question is a simple identity question that doesn't need RAG."""
    normalized = q.lower().strip().rstrip('?')
    return (
        normalized in IDENTITY_QUESTIONS
        or any(normalized.startswith(p) for p in ["quem é ", "who is ", "what is aria"])
    )

def _is_trivial_greeting(q: str) -> bool:
    """Return True if the question is a trivial greeting that doesn't need RAG."""
    normalized = q.lower().strip().rstrip('!').rstrip('?')
    trivial_greetings = {
        "oi", "ola", "olá", "hi", "hey", "hello", "bom dia", "boa tarde",
        "boa noite", "eae", "eaí", "e ai", " fala ", "fala", "suave", "tmp",
        "td bem", "tá bom", "como vai", "como vai?", "tudo bem", "beleza",
        "hey all", "hi there", "hello there", "oii", "oiii", "oi!", "olá!",
        "bom dia!", "oi,", "ola,", "hi,", "hey,", "oi tudo bem", "oi, td bem",
    }
    return (
        normalized in trivial_greetings
        or (len(normalized) <= 3 and not any(c.isalnum() for c in normalized) is False)
        or (len(normalized) <= 2 and normalized in "oi oi oi olláhi hey".split())
    )

TRIVIAL_GREETING_RESPONSE = """Olá! 👋 Eu sou a ARIA, sua assistente de radiologia por IA.

Estou aqui pra ajudar com dúvidas sobre radiology, casos clínicos, preparação para provas como CBR, USG, RDDI, e muito mais.

Pode me perguntar qualquer coisa!"""

ARIA_IDENTITY = """Você é ARIA — Assistente de Radiologia por IA.

Sou uma inteligência artificial especializada em radiologia, desenvolvida pela equipe do RadioeXperience.

Minha missão é ajudar médicos, estudantes e profissionais de saúde a aprender radiologia de forma interativa, tirarem dúvidas sobre anatomia radiológica, técnicas de exame, interpretação de achados e classificação de imagens médicas.

Estou integrada à base de conhecimento do RadioeXperience, que inclui livros e artigos de radiologia, e posso analisar imagens médicas usando visão computacional.

Como posso ajudar hoje?"""

# ── Auth Dependency (Supabase JWT) ───────────────────────────────────────────
async def verify_supabase_token(authorization: str = None) -> dict | None:
    """Verify Supabase JWT and return user info. Returns None if no auth (public endpoint).
    
    Decodes JWT payload to extract user sub/email, then verifies by looking up
    the user in the profiles table using the service role key (bypasses RLS).
    """
    if not authorization:
        return None
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            return None
        
        # Decode JWT payload without verification — trust the issuer signature
        try:
            import base64
            payload_b64 = token.split('.')[1]
            padding = 4 - len(payload_b64) % 4
            if padding < 4:
                payload_b64 += '=' * padding
            payload = json.loads(base64.b64decode(payload_b64))
            user_id = payload.get('sub')
            email = payload.get('email', '')
            if not user_id:
                return None
        except Exception as e:
            print(f"[DEBUG] JWT decode error: {e}")
            return None
        
        print(f"[DEBUG] verify_supabase_token called, user_id={user_id}, email={email}")
        
        # Verify by looking up user in profiles table via Supabase REST API
        supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
        print(f"[DEBUG] service_key present: {bool(service_key)}")
        if not service_key:
            return None
        
        client = await get_http_client()
        resp = await client.get(
            f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}&select=id,email,full_name",
            headers={
                "Authorization": f"Bearer {service_key}",
                "apikey": service_key,
                "Content-Type": "application/json",
                "Prefer": "count=none",
            },
        )
        print(f"[DEBUG] profiles response: status={resp.status_code}, body={resp.text[:200]}")
        if resp.status_code == 200:
            profiles = resp.json()
            if profiles and len(profiles) > 0:
                return {
                    "id": user_id,
                    "email": profiles[0].get('email') or email,
                    "user_metadata": {
                        "full_name": profiles[0].get('full_name') or email.split('@')[0]
                    },
                }
        
        return None
    except Exception as e:
        print(f"[DEBUG] verify_supabase_token exception: {e}")
        return None


# ── Retry Decorators ─────────────────────────────────────────────────────────
OPENAI_RETRY = stop_after_attempt(3)
QDRANT_RETRY = stop_after_attempt(3)

def with_retry(exceptions, max_attempts=3):
    return retry(
        retry=retry_if_exception_type(exceptions),
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )

# Retry-friendly wrappers
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _embed_with_retry(text: str) -> list:
    """Embed text with exponential backoff retry."""
    resp = openai_client.embeddings.create(input=[text], model=EMBED_MODEL)
    return resp.data[0].embedding

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _qdrant_search_with_retry(**kwargs):
    """Search Qdrant with exponential backoff retry."""
    return qdrant.query_points(**kwargs)


# ── Models ──
class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=10, ge=1, le=20)
    specialty: str | None = Field(default=None, max_length=100)
    image_base64: str | None = Field(default=None, max_length=10_000_000)  # ~10MB max

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Question cannot be empty")
        return v.strip()

class Source(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
SYSTEM_PROMPT = """Você é ARIA — radiologista experiente, didática e acessível. Sua missão é ser copilota de raciocínio clínico-radiológico, não apenas responder perguntas, mas ajudar o usuário a pensar melhor.

## IDENTIDADE
Colega brilhante e acessível. Preceptora que ensina sem humilhar. Clara, técnica, segura sem arrogância, humana e memorável.

NUNCA seja: chatbot genérico, enciclopédia fria, cursinho automático, personagem teatral, assistente com bordões fixos.

## PRINCÍPIO CENTRAL
Conduza até a resposta quando houver valor pedagógico. Não entregue —orgue.

Sua missão:
1. Acolher a dúvida naturalmente
2. Organizar o problema
3. Destacar o que importa
4. Abrir hipóteses plausíveis
5. Mostrar o que favorece e o que enfraquece cada caminho
6. Consolidar a melhor conclusão com clareza e prudência

## MODO PRECEPTORIA
Quando houver caso clínico, interpretação de imagem, hipótese diagnóstica ou laudo em construção:
- Abrir de forma natural e envolvente
- Organizar o problema
- Propor hipóteses plausíveis
- Comparar caminhos
- Corrigir desvios de raciocínio com firmeza e elegância
- Consolidar após a condução
- Fechar com regra mental, checklist ou aplicação prática

## QUANDO SER DIRETA
Se o usuário quiser definição objetiva, resposta rápida ou conceito factual, responda com clareza sem alongar.

## COLETA DE CONTEXTO
Pergunte apenas o que realmente muda o raciocínio. Perguntas curtas, naturais, estratégicas. Nada de listas burocráticas.

## DIFERENCIAR SEMPRE
- ACHADO: o que está objetivamente presente
- INTERPRETAÇÃO: o que esse achado sugere
- CONCLUSÃO: hipótese mais provável + contexto

## PRUDÊNCIA DIAGNÓSTICA
Use linguagem de probabilidade quando necessário — "compatível com", "sugere", "favorece", "pode corresponder a", "menos provável", "depende de correlação clínica". Evite overcall.

## ENSINO POR RACIOCÍNIO GUIADO
- Transforme achado em eixo de raciocínio
- Mostre como priorizar hipóteses
- Explique o peso relativo de cada achado
- Separe achado inespecífico de achado orientador
- Mostre o que é compatível, sugestivo ou típico
- Evite que qualquer pista vire diagnóstico fechado

## CORREÇÃO DE ERROS
Reconheça o que faz sentido no raciocínio do usuário → mostre onde ocorreu o desvio → reconstrua o caminho correto → ensine como evitar. Firme, elegante, nunca agressiva.

## ADAPTAÇÃO AO NÍVEL
Simplifique mais se parecer iniciante; refine nuances se parecer avançado. Sem infantilizar.

## FECHAMENTO COM VALOR
Termine com regra mental, pegadinha, checklist ou próximo passo prático.

## INSTRUÇÕES DE ESTILO
- Seja conversacional, natural e marcante
- Ensine antes de concluir quando agregar valor
- Proponha hipóteses plausíveis
- Destaque pegadinhas, erros comuns e falsos atalhos mentais
- Explique por que uma hipótese sobe e por que outra cai
- Diferencie essencial de complementar
- Não seja prolixa, não seja fria, não seja teatral
- Não faça perguntas desnecessárias, não transforme tudo em quiz

## CONTEXTO RECUPERADO:
{context}

## REGRAS DE grounding (RAG)
- Use prioritariamente conteúdo recuperado da base de conhecimento
- Não invente informação fora do contexto recuperado
- Se insuficiente para concluir, diga com honestidade
- Se faltar dado clínico essencial, peça apenas o que muda o raciocínio
- Diferencie achado, interpretação e conclusão
- Se base sustentar múltiplas possibilidades, organize em ordem de probabilidade
- Não trate achado inespecífico como diagnóstico fechado
- Se contexto trouxer informação conflitante, reconheça a limitação
- Sempre priorize segurança interpretativa e coerência clínica
"""


# ── Routes ──
@app.get("/health")
def health():
    """Deep health check — valida Qdrant, OpenAI e colecao."""
    checks = {}
    overall_ok = True

    # 1. Qdrant connectivity
    try:
        cols = qdrant.get_collections()
        checks["qdrant"] = {"status": "ok", "collections": [c.name for c in cols.collections]}
    except Exception as e:
        checks["qdrant"] = {"status": "error", "detail": str(e)}
        overall_ok = False

    # 2. Collection count
    try:
        count = qdrant.count(collection_name=COLLECTION).count
        checks["qdrant"]["documents_indexed"] = count
        if count == 0:
            checks["qdrant"]["warning"] = "Colecao vazia"
    except Exception as e:
        checks["qdrant"]["count_error"] = str(e)
        overall_ok = False

    # 3. OpenAI API key
    try:
        openai_client.models.list()
        checks["openai"] = {"status": "ok"}
    except Exception as e:
        checks["openai"] = {"status": "error", "detail": str(e)}
        overall_ok = False

    # 4. Supabase connectivity
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        if supabase_url and supabase_key:
            r = httpx.get(f"{supabase_url}/rest/v1/shifts?select=id&limit=1", headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}, timeout=10)
            checks["supabase"] = {"status": "ok" if r.status_code < 500 else "degraded"}
        else:
            checks["supabase"] = {"status": "not_configured"}
    except Exception as e:
        checks["supabase"] = {"status": "error", "detail": str(e)}

    status_code = 200 if overall_ok else 503
    return {"status": "ok" if overall_ok else "degraded", "checks": checks}, status_code


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
    source_file: str | None = None  # original filename for batch tracking

class ShiftBatchRequest(BaseModel):
    batch_id: str


class ShiftUpdateRequest(BaseModel):
    location: str | None = None
    room: str | None = None
    day_of_week: str | None = None
    time_slot: str | None = None
    doctor_name: str | None = None
    status: str | None = None
    specialty: str | None = None

@app.post("/upload-shifts")
async def upload_shifts(req: ShiftUploadRequest):
    """
    Recebe imagens (base64) de escala médica, extrai dados via GPT-4o vision,
    e salva na tabela shifts do Supabase.
    """
    if not req.images:
        raise HTTPException(status_code=400, detail="Nenhuma imagem fornecida")

    vision_messages = []
    for image_value in req.images[:4]:  # max 4 pages
        image_url = image_value if image_value.startswith("data:") else f"data:image/jpeg;base64,{image_value}"
        vision_messages.append({
            "type": "image_url",
            "image_url": {"url": image_url, "detail": "high"},
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
            model="gpt-5.4-mini",
            messages=[
                {"role": "system", "content": extraction_prompt},
                {"role": "user", "content": vision_messages},
            ],
            temperature=0.1,
            max_completion_tokens=12000,
        )
        raw_response = response.choices[0].message.content

        import json
        # Strip markdown code blocks if present
        clean = raw_response.strip()
        if clean.startswith('```'):
            clean = clean.split('\n', 1)[1] if '\n' in clean else clean[3:]
        if clean.endswith('```'):
            clean = clean.rsplit('```', 1)[0]
        clean = clean.strip()
        json_start = clean.find('[')
        json_end = clean.rfind(']') + 1
        if json_start >= 0 and json_end > json_start:
            try:
                shifts = json.loads(clean[json_start:json_end])
            except json.JSONDecodeError:
                # Truncated JSON - try repairing
                repaired = clean[json_start:json_end]
                repaired = repaired.rstrip(', \n')
                if not repaired.endswith(']'):
                    repaired += ']'
                shifts = json.loads(repaired)
        elif json_start >= 0:
            # No closing ']' at all - truncate happened before any ']' was written
            repaired = clean[json_start:].rstrip(', \n\t')
            # Remove incomplete trailing object (find last complete '}')
            last_brace = repaired.rfind('}')
            if last_brace > 0:
                repaired = repaired[:last_brace + 1]
            repaired += ']'
            shifts = json.loads(repaired)
        else:
            raise ValueError(f"No JSON array found. Raw response: {clean[:500]}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar: {str(e)}")

    import httpx
    import uuid
    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY não configurada")
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    base = f"{supabase_url}/rest/v1"

    # Generate batch_id from filename
    import hashlib
    source_file = getattr(req, 'source_file', None) or "upload"
    batch_id = f"{source_file}_{hashlib.md5(f'{source_file}_{datetime.now().isoformat()}'.encode()).hexdigest()[:8]}"

    # Tag each shift with batch info
    for s in shifts:
        s["batch_id"] = batch_id
        s["source_file"] = source_file

    # Clear old shifts
    delete_resp = httpx.delete(f"{base}/shifts?id=neq.00000000-0000-0000-0000-000000000000", headers=headers, timeout=30)
    if delete_resp.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"Erro ao limpar shifts no Supabase: {delete_resp.status_code} {delete_resp.text}")

    # Insert in batches
    BATCH_SIZE = 100
    inserted = 0
    for i in range(0, len(shifts), BATCH_SIZE):
        batch = shifts[i:i + BATCH_SIZE]
        insert_resp = httpx.post(f"{base}/shifts", headers=headers, json=batch, timeout=30)
        if insert_resp.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Erro ao inserir shifts no Supabase: {insert_resp.status_code} {insert_resp.text}")
        inserted += len(batch)

    return {
        "message": f"{inserted} vagas processadas com sucesso",
        "locations": list(set(s.get("location", "") for s in shifts)),
        "available": sum(1 for s in shifts if s.get("status") == "available"),
        "total": inserted,
        "batch_id": batch_id,
        "source_file": source_file,
    }


@app.patch("/shifts/{shift_id}")
def update_shift(shift_id: str, req: ShiftUpdateRequest):
    import httpx
    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY não configurada")

    payload = {k: v for k, v in req.model_dump().items() if v is not None}

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    resp = httpx.patch(
        f"{supabase_url}/rest/v1/shifts?id=eq.{shift_id}",
        headers=headers,
        json=payload,
        timeout=30,
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar shift: {resp.status_code} {resp.text}")
    data = resp.json() if resp.text else []
    return {"ok": True, "shift": data[0] if data else None}


@app.get("/shifts")
def get_shifts(location: str | None = None, day: str | None = None, status: str | None = None):
    """Lista vagas com filtros opcionais."""
    import httpx
    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY não configurada")
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


def _parse_iso_date(date_str: str) -> str:
    try:
        normalized = date_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SSZ).")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


@app.delete("/shifts/bulk")
def bulk_delete_shifts(body: dict = {}):
    """Remove vagas em lote por batch_id, location, specialty ou data."""
    import httpx
    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY não configurada")
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Prefer": "return=representation",
    }
    params = {}
    if body.get("batch_id"):
        params["batch_id"] = f"eq.{body['batch_id']}"
    if body.get("location"):
        params["location"] = f"eq.{body['location']}"
    if body.get("specialty"):
        params["specialty"] = f"eq.{body['specialty']}"
    if body.get("before_date"):
        params["created_at"] = f"lt.{_parse_iso_date(body['before_date'])}"
    if not params:
        raise HTTPException(status_code=400, detail="Nenhum filtro fornecido")
    r = httpx.delete(f"{supabase_url}/rest/v1/shifts", headers=headers, params=params)
    if r.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"Falha ao remover: {r.text}")
    data = r.json() if r.text else []
    return {"deleted": len(data)}


@app.delete("/shifts/{shift_id}")
def delete_shift(shift_id: str):
    """Remove uma vaga por ID."""
    import httpx
    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY não configurada")
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Prefer": "return=representation",
    }
    params = {"id": f"eq.{shift_id}"}
    r = httpx.delete(f"{supabase_url}/rest/v1/shifts", headers=headers, params=params)
    if r.status_code >= 400:
        raise HTTPException(status_code=500, detail="Falha ao remover vaga")
    data = r.json() if r.text else []
    return {"deleted": len(data)}


@app.delete("/shifts")
def delete_shifts(before: str | None = None, after: str | None = None, batch_id: str | None = None, location: str | None = None):
    """Remove vagas por intervalo de created_at, batch_id ou location."""
    if not before and not after and not batch_id and not location:
        raise HTTPException(status_code=400, detail="Informe before, after, batch_id ou location")
    import httpx
    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY não configurada")
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Prefer": "return=representation",
    }
    params = {}
    if batch_id:
        params["batch_id"] = f"eq.{batch_id}"
    if location:
        params["location"] = f"eq.{location}"
    if before:
        params["created_at"] = f"lt.{_parse_iso_date(before)}"
    if after:
        params["created_at"] = f"gte.{_parse_iso_date(after)}"
    r = httpx.delete(f"{supabase_url}/rest/v1/shifts", headers=headers, params=params)
    if r.status_code >= 400:
        raise HTTPException(status_code=500, detail="Falha ao remover vagas")
    data = r.json() if r.text else []
    return {"deleted": len(data)}


@app.get("/shifts/batches")
def list_batches():
    """Lista todos os lotes de upload (agrupados por batch_id)."""
    import httpx
    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY não configurada")
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    # Get all shifts with batch info
    r = httpx.get(
        f"{supabase_url}/rest/v1/shifts",
        headers=headers,
        params={"select": "batch_id,source_file,created_at", "order": "created_at.desc"},
        timeout=30,
    )
    if r.status_code >= 400:
        raise HTTPException(status_code=500, detail="Erro ao listar lotes")
    shifts = r.json()
    # Group by batch_id
    batches = {}
    for s in shifts:
        bid = s.get("batch_id") or "legacy"
        if bid not in batches:
            batches[bid] = {
                "batch_id": bid,
                "source_file": s.get("source_file", "upload antigo"),
                "count": 0,
                "created_at": s.get("created_at"),
            }
        batches[bid]["count"] += 1
    return {"batches": list(batches.values()), "total_shifts": len(shifts)}


@app.post("/chat/stream")
@limiter.limit("60/minute")
async def chat_stream(request: Request, req: ChatRequest, authorization: str = None):
    """Streaming version of /chat — yields SSE tokens for real-time display."""
    request_id = str(uuid.uuid4())
    user = await verify_supabase_token(authorization)
    logger.info(
        "Chat stream request",
        request_id=request_id,
        user_id=user.get("id") if user else None,
        question_len=len(req.question),
        has_image=bool(req.image_base64),
    )

    # 0. Trivial greeting check — bypass RAG
    if _is_trivial_greeting(req.question) or _is_identity_question(req.question):
        greeting_response = TRIVIAL_GREETING_RESPONSE if _is_trivial_greeting(req.question) else ARIA_IDENTITY
        async def greeting_stream():
            for word in greeting_response:
                yield f"event: token\ndata: {word}\n\n"
            yield "event: done\ndata: {}\n\n"
        return StreamingResponse(greeting_stream(), media_type="text/event-stream", headers={"X-Request-ID": request_id})

    # 0. Image description (sync OpenAI client is thread-safe)
    search_query = req.question
    image_description = None
    image_context = ""
    image_sources = []
    if req.image_base64:
        raw_b64 = req.image_base64
        if raw_b64.startswith('data:'):
            raw_b64 = raw_b64.split(',', 1)[1] if ',' in raw_b64 else raw_b64
        image_data_url = f"data:image/jpeg;base64,{raw_b64}"
        try:
            desc_response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a radiology education assistant. Describe the imaging findings visible in this medical image for educational purposes."},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Describe the imaging findings in this medical image for educational purposes:"},
                        {"type": "image_url", "image_url": {"url": image_data_url, "detail": "high"}},
                    ]},
                ],
                temperature=0.2,
                max_completion_tokens=500,
            )
            image_description = desc_response.choices[0].message.content
            search_query = f"{req.question}\n\nAchados da imagem: {image_description}"
        except Exception as e:
            logger.warning(f"Image description failed: {e}")

        try:
            image_context, image_sources = search_similar_images(req.image_base64, top_k=5)
        except Exception as e:
            logger.warning(f"BiomedCLIP search failed: {e}")

    # 1. Embed
    try:
        embedding = _embed_with_retry(search_query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding error: {e}")

    # 2. Search Qdrant
    query_filter = None
    if req.specialty:
        from qdrant_client.models import FieldCondition, MatchValue, Filter
        normalized_sp = _normalize_specialty(req.specialty)
        query_filter = Filter(
            must=[FieldCondition(key="specialty", match=MatchValue(value=normalized_sp))]
        )

    try:
        results = _qdrant_search_with_retry(
            collection_name=COLLECTION,
            query=embedding,
            limit=max(req.top_k, 50),
            query_filter=query_filter,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {e}")

    # 2.5 Hybrid re-ranking
    import re
    stopwords = {"o", "a", "os", "as", "de", "da", "do", "das", "dos", "em", "na", "no",
                 "que", "e", "é", "um", "uma", "com", "por", "para", "se", "qual", "quais",
                 "como", "sao", "são", "este", "esta", "isso", "esse", "essa", "mais", "menos",
                 "sobre", "entre", "seu", "sua", "seus", "suas", "pelo", "pela", "onde", "quando",
                 "paciente", "tipo"}
    words = re.findall(r'\b[a-záàâãéèêíïóôõöúçñ]{4,}\b', req.question.lower())
    key_terms = [w for w in words if w not in stopwords]
    question_words = re.findall(r'\b[a-záàâãéèêíïóôõöúçñ]+\b', req.question.lower())
    bigrams = [f"{question_words[i]} {question_words[i+1]}"
               for i in range(len(question_words)-1)
               if question_words[i] not in stopwords and question_words[i+1] not in stopwords]

    seen_ids = {hit.id for hit in results.points}
    if key_terms:
        try:
            focused_emb = _embed_with_retry(" ".join(key_terms[:5]))
            extra_results = _qdrant_search_with_retry(
                collection_name=COLLECTION, query=focused_emb, limit=20, query_filter=query_filter,
            )
            for hit in extra_results.points:
                if hit.id not in seen_ids:
                    results.points.append(hit)
                    seen_ids.add(hit.id)
        except Exception:
            pass

    scored_hits = []
    for hit in results.points:
        text_lower = hit.payload.get("text", "").lower()
        keyword_boost = sum(0.02 * min(text_lower.count(t), 5) for t in key_terms)
        keyword_boost += sum(0.05 * min(text_lower.count(b), 3) for b in bigrams)
        scored_hits.append((hit.score + keyword_boost, hit))
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
        context_parts.append(f"[Fonte {i}: {title}, p.{page_start}-{page_end}]\n{excerpt}")
        sources.append(Source(title=title, page_start=page_start, page_end=page_end,
                              score=round(hit.score, 4), excerpt=excerpt[:300]))

    context = "\n\n---\n\n".join(context_parts)
    if image_context:
        context = f"{image_context}\n\n---\n\n{context}" if context else image_context
        for s in image_sources:
            sources.append(Source(title=s.get("title", ""), page_start=s.get("page"),
                                  page_end=s.get("page"), score=round(s.get("score", 0), 4), excerpt=""))

    # Score gate
    top_boosted_score = scored_hits[0][0] if scored_hits else 0.0
    if top_boosted_score < MIN_RELEVANCE_SCORE and not image_context:
        logger.info(f"Rejected: top_boosted_score={top_boosted_score:.3f} < {MIN_RELEVANCE_SCORE}")
        error_msg = "Não encontrei informações suficientes na base de conhecimento para responder essa pergunta. Tente reformular com mais detalhes."
        async def error_stream():
            yield f"data: {json.dumps({'event': 'error', 'data': error_msg})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    # 4. Stream the answer
    system_prompt = SYSTEM_PROMPT.format(context=context)
    if req.image_base64:
        img_ctx = f"\n\nDESCRIÇÃO DA IMAGEM (pré-análise):\n{image_description}" if image_description else ""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": [
                {"type": "text", "text": f"PERGUNTA DO USUÁRIO:\n{req.question}{img_ctx}\n\nCONTEXTO DA BASE DE CONHECIMENTO:\n{context}"},
                {"type": "image_url", "image_url": {"url": image_data_url, "detail": "high"}},
            ]},
        ]
        model = "gpt-5.4"
    else:
        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": req.question}]
        model = "gpt-4o-mini"

    async def stream_response():
        try:
            # Run sync OpenAI stream in thread pool to avoid blocking the event loop
            stream = await asyncio.to_thread(
                openai_client.chat.completions.create,
                model=model,
                messages=messages,
                temperature=0.3,
                max_completion_tokens=2000,
                stream=True,
            )
            collected = []
            for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    collected.append(token)
                    yield f"data: {json.dumps({'event': 'token', 'data': token})}\n\n"
            yield f"data: {json.dumps({'event': 'done', 'sources': [s.model_dump() for s in sources[:3]]})}\n\n"
            logger.info(f"Stream complete", request_id=request_id, tokens=len(collected))
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'event': 'error', 'data': str(e)})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Request-ID": request_id,
        },
    )


@app.post("/chat", response_model=ChatResponse)
@limiter.limit("60/minute")
async def chat(request: Request, req: ChatRequest, authorization: str = None):
    """Non-streaming fallback for /chat — mirrors the RAG logic of the streaming version."""
    request_id = str(uuid.uuid4())
    user = await verify_supabase_token(authorization)
    logger.info(
        "Chat request",
        request_id=request_id,
        user_id=user.get("id") if user else None,
        question_len=len(req.question),
        has_image=bool(req.image_base64),
    )

    # Trivial greeting / identity shortcut
    if _is_trivial_greeting(req.question) or _is_identity_question(req.question):
        response_text = TRIVIAL_GREETING_RESPONSE if _is_trivial_greeting(req.question) else ARIA_IDENTITY
        return ChatResponse(answer=response_text, sources=[], tokens_used=0)

    search_query = req.question
    image_description = None
    image_context = ""
    image_sources = []
    if req.image_base64:
        raw_b64 = req.image_base64
        if raw_b64.startswith('data:'):
            raw_b64 = raw_b64.split(',', 1)[1] if ',' in raw_b64 else raw_b64
        image_data_url = f"data:image/jpeg;base64,{raw_b64}"
        try:
            desc_response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a radiology education assistant. Describe the imaging findings."},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Describe the imaging findings in this medical image:"},
                        {"type": "image_url", "image_url": {"url": image_data_url, "detail": "high"}},
                    ]},
                ],
                temperature=0.2,
                max_completion_tokens=500,
            )
            image_description = desc_response.choices[0].message.content
            search_query = f"{req.question}\n\nAchados da imagem: {image_description}"
        except Exception as e:
            logger.warning(f"Image description failed: {e}")
        try:
            image_context, image_sources = search_similar_images(req.image_base64, top_k=5)
        except Exception as e:
            logger.warning(f"BiomedCLIP search failed: {e}")

    try:
        embedding = _embed_with_retry(search_query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding error: {e}")

    query_filter = None
    if req.specialty:
        from qdrant_client.models import FieldCondition, MatchValue, Filter
        query_filter = Filter(
            must=[FieldCondition(key="specialty", match=MatchValue(value=_normalize_specialty(req.specialty)))]
        )

    try:
        results = _qdrant_search_with_retry(
            collection_name=COLLECTION,
            query=embedding,
            limit=max(req.top_k, 50),
            query_filter=query_filter,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {e}")

    # Hybrid re-ranking
    import re
    stopwords = {"o","a","os","as","de","da","do","das","dos","em","na","no",
                 "que","e","é","um","uma","com","por","para","se","qual","quais",
                 "como","sao","são","este","esta","isso","esse","essa","mais","menos",
                 "sobre","entre","seu","sua","seus","suas","pelo","pela","onde","quando",
                 "paciente","tipo"}
    words = re.findall(r'\b[a-záàâãéèêíïóôõöúçñ]{4,}\b', req.question.lower())
    key_terms = [w for w in words if w not in stopwords]
    question_words = re.findall(r'\b[a-záàâãéèêíïóôõöúçñ]+\b', req.question.lower())
    bigrams = [f"{question_words[i]} {question_words[i+1]}"
               for i in range(len(question_words)-1)
               if question_words[i] not in stopwords and question_words[i+1] not in stopwords]

    seen_ids = {hit.id for hit in results.points}
    if key_terms:
        try:
            focused_emb = _embed_with_retry(" ".join(key_terms[:5]))
            extra = _qdrant_search_with_retry(collection_name=COLLECTION, query=focused_emb, limit=20, query_filter=query_filter)
            for hit in extra.points:
                if hit.id not in seen_ids:
                    results.points.append(hit)
                    seen_ids.add(hit.id)
        except Exception:
            pass

    scored_hits = []
    for hit in results.points:
        text_lower = hit.payload.get("text", "").lower()
        boost = sum(0.02*min(text_lower.count(t),5) for t in key_terms)
        boost += sum(0.05*min(text_lower.count(b),3) for b in bigrams)
        scored_hits.append((hit.score + boost, hit))
    scored_hits.sort(key=lambda x: x[0], reverse=True)
    ranked_hits = [hit for _, hit in scored_hits[:req.top_k]]

    sources = []
    context_parts = []
    for i, hit in enumerate(ranked_hits, 1):
        p = hit.payload
        excerpt = p.get("text", "")[:800]
        title = p.get("title", "Desconhecido")
        page_start, page_end = p.get("page_start"), p.get("page_end")
        context_parts.append(f"[Fonte {i}: {title}, p.{page_start}-{page_end}]\n{excerpt}")
        sources.append(Source(title=title, page_start=page_start, page_end=page_end,
                             score=round(hit.score, 4), excerpt=excerpt[:300]))

    context = "\n\n---\n\n".join(context_parts)
    if image_context:
        context = f"{image_context}\n\n---\n\n{context}" if context else image_context
        for s in image_sources:
            sources.append(Source(title=s.get("title",""), page_start=s.get("page"),
                                  page_end=s.get("page"), score=round(s.get("score",0),4), excerpt=""))

    top_boosted_score = scored_hits[0][0] if scored_hits else 0.0
    if top_boosted_score < MIN_RELEVANCE_SCORE and not image_context:
        return ChatResponse(
            answer="Não encontrei informações suficientes na base de conhecimento para responder essa pergunta. Tente reformular com mais detalhes — por exemplo, inclua a especialidade, o tipo de exame ou a região anatômica.",
            sources=[], tokens_used=0,
        )

    system_prompt = SYSTEM_PROMPT.format(context=context)
    if req.image_base64:
        img_ctx = f"\n\nDESCRIÇÃO DA IMAGEM (pré-análise):\n{image_description}" if image_description else ""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": [
                {"type": "text", "text": f"PERGUNTA DO USUÁRIO:\n{req.question}{img_ctx}\n\nCONTEXTO DA BASE DE CONHECIMENTO:\n{context}"},
                {"type": "image_url", "image_url": {"url": image_data_url, "detail": "high"}},
            ]},
        ]
        model = "gpt-5.4"
    else:
        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": req.question}]
        model = "gpt-4o-mini"

    try:
        response = openai_client.chat.completions.create(
            model=model, messages=messages, temperature=0.3, max_completion_tokens=2000,
        )
        answer = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {e}")

    if "Fonte:" not in answer and "fonte:" not in answer.lower() and sources:
        if "não encontrei" not in answer.lower() and "nao encontrei" not in answer.lower():
            refs = "; ".join(
                f"[Fonte: {s.title[:60]}, p.{s.page_start}-{s.page_end}]" if s.page_start else f"[Fonte: {s.title[:60]}]"
                for s in sources[:3]
            )
            answer += f"\n\n📚 Fontes consultadas: {refs}"

    return ChatResponse(answer=answer, sources=sources, tokens_used=tokens_used)


class ChatEditRequest(BaseModel):
    question: str
    content: str          # current project content (for context)
    template: str         # script | slides | mapa_mental | tabela | questoes | caso_clinico
    topic: str            # project topic/title
    top_k: int = 6
    specialty: str | None = None
    image_base64: str | None = None

    def validate_question(self):
        if not self.question or not self.question.strip():
            raise ValueError("Question cannot be empty")
        if len(self.question) > 2000:
            raise ValueError("Question too long (max 2000 characters)")

SYSTEM_PROMPT_EDIT = """Você é ARIA Edit — assistente de EDIÇÃO de conteúdo educacional de radiologia da plataforma RadioeXperience.

Você NÃO gera conteúdo novo do zero. Você ajuda a EDITAR, REVISAR e MELHORAR conteúdo que o usuário já possui.

## SUAS TAREFAS PRINCIPAIS:
- Melhorar clareza, precisão e didática do texto existente
- Corrigir erros médicos ou de formatação
- Adaptar o nível de detalhe (mais avançado ou mais introdutório)
- Expandir ou condensar seções mantendo a qualidade
- Sugerir reestruturações para melhor fluxo educativo
- Manter consistência de estilo e terminologia
- Responder dúvidas sobre o conteúdo (ex: "esse achado está correto?", "posso substituir por...?")
- Ajudar a transformar conteúdo de um formato para outro (script → slides, por exemplo)

## CONTEÚDO ATUAL DO PROJETO:
O usuário trabalha com o seguinte conteúdo de radiologia. Use-o como base para suas sugestões de edição:

{content_context}

## FORMATO DO CONTEÚDO:
O conteúdo está no formato: **{template_label}**
- **script**: aula textual estruturada com seções (Hook, Conceitos, Caso Clínico, Pontos-Chave)
- **slides**: conjunto de slides em markdown com ## SLIDE N – Título e bullet points
- **mapa_mental**: árvore hierárquica com # Título, ## Ramo, ### Subcategoria
- **tabela**: tabela comparativa markdown com | Coluna | Coluna |
- **questoes**: 5 questões de múltipla escolha no formato **QUESTÃO N:**... **Resposta Correta:** **Explicação:**
- **caso_clinico**: caso clínico com ## Anamnese, ## Exame Físico, ## Exames de Imagem, ## Discussão

## REGRAS DE EDIÇÃO:
1. Quando pedir para editar/aprimorar: retorne o conteúdo completo com suas alterações aplicadas, precedido de "EDITADO:"
2. Quando pedir para revisar: liste os pontos específicos encontrados e sugira melhorias
3. Quando responder dúvidas sobre o conteúdo: cite partes específicas do texto ("No trecho sobre..., o termo usado está correto porque...")
4. Quando transformar formato: mantenha TODA a informação científica do original
5. Nunca invente informações médicas. Use a base RAG para verificar fatos.
6. Respeite a estrutura e formatação do formato destination

## USO DA BASE RAG:
Você TEM acesso à base de conhecimento de radiologia via busca semântica. Use-a para:
- Verificar se afirmações médicas estão corretas
- Complementar informações quando o usuário pedir para "expandir"
- Sugerir critérios diagnósticos, classificações ou guidelines relevantes
- NÃO repita texto da base RAG verbatim — use para verificar e enriquecer

## ESTILO:
- Portuguese brasileiro formal e didático
- Seja preciso: termine frases completas, não deixe "..." ou lacunas
- Mantenha terminologia radiológica consistente (BI-RADS, TI-RADS, etc.)
- Ao editar, comente INDENTADAMENTE o que mudou: mostre ANTES → DEPOIS quando relevante

## QUANDO O USUÁRIO PEDIR EDIÇÃO:
Comece sua resposta com "EDITADO:" seguido do conteúdo completo com edições.
Se várias mudanças pequenas: liste cada uma com linha A→B antes do conteúdo final.
Se mudança estrutural: explique brevemente a lógica antes do conteúdo.
"""


@app.post("/chat/edit", response_model=ChatResponse)
def chat_edit(req: ChatEditRequest):
    logger.info(f"ChatEdit request: template={req.template}, topic={req.topic[:50]}, question_len={len(req.question)}")

    template_labels = {
        "script": "Script de Aula",
        "slides": "Slides Didáticos",
        "mapa_mental": "Mapa Mental",
        "tabela": "Tabela Comparativa",
        "questoes": "Questões de Estudo",
        "caso_clinico": "Caso Clínico",
    }
    template_label = template_labels.get(req.template, req.template)

    content_context = f"""Título do projeto: {req.topic}
Tipo: {template_label}
Conteúdo atual:
{req.content[:4000]}
""" if req.content else f"Título: {req.topic}\nTipo: {template_label}\n(Nenhum conteúdo ainda)"

    system_prompt = SYSTEM_PROMPT_EDIT.format(
        content_context=content_context,
        template_label=template_label,
    )

    # ── RAG search ──────────────────────────────────────────────────────────────
    search_query = req.question
    if req.image_base64:
        raw_b64 = req.image_base64
        if raw_b64.startswith('data:'):
            raw_b64 = raw_b64.split(',', 1)[1] if ',' in raw_b64 else raw_b64
        image_data_url = f"data:image/jpeg;base64,{raw_b64}"
        try:
            desc_response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a radiology education assistant. Briefly describe the imaging findings visible in this medical image."},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Describe the imaging findings:"},
                        {"type": "image_url", "image_url": {"url": image_data_url, "detail": "high"}},
                    ]},
                ],
                temperature=0.2,
                max_completion_tokens=300,
            )
            search_query = f"{req.question}\n\nImagem: {desc_response.choices[0].message.content}"
        except Exception as e:
            logger.warning(f"Image desc failed in edit chat: {e}")

    # Embed + search
    try:
        embedding = _embed_with_retry(search_query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding error: {e}")

    query_filter = None
    if req.specialty:
        from qdrant_client.models import FieldCondition, MatchValue, Filter
        normalized_sp = _normalize_specialty(req.specialty)
        query_filter = Filter(
            must=[FieldCondition(key="specialty", match=MatchValue(value=normalized_sp))]
        )

    try:
        results = _qdrant_search_with_retry(
            collection_name=COLLECTION,
            query=embedding,
            limit=req.top_k,
            query_filter=query_filter,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {e}")

    sources = []
    context_parts = []
    for i, hit in enumerate(results.points, 1):
        p = hit.payload
        excerpt = p.get("text", "")[:600]
        title = p.get("title", "Desconhecido")
        page_start = p.get("page_start")
        page_end = p.get("page_end")
        context_parts.append(f"[Fonte {i}: {title}, p.{page_start}-{page_end}]\n{excerpt}")
        sources.append(Source(
            title=title,
            page_start=page_start,
            page_end=page_end,
            score=round(hit.score, 4),
            excerpt=excerpt[:200],
        ))

    rag_context = "\n\n---\n\n".join(context_parts) if context_parts else ""

    # ── Generate ───────────────────────────────────────────────────────────────
    try:
        if req.image_base64:
            raw_b64 = req.image_base64
            if raw_b64.startswith('data:'):
                raw_b64 = raw_b64.split(',', 1)[1] if ',' in raw_b64 else raw_b64
            image_data_url = f"data:image/jpeg;base64,{raw_b64}"
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": f"PERGUNTA:\n{req.question}\n\nCONTEXTO RAG:\n{rag_context}"},
                    {"type": "image_url", "image_url": {"url": image_data_url, "detail": "high"}},
                ]},
            ]
        else:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"PERGUNTA:\n{req.question}\n\nCONTEXTO RAG (verifique Facts neste contexto):\n{rag_context}"},
            ]

        response = openai_client.chat.completions.create(
            model="gpt-5.4-mini",
            messages=messages,
            temperature=0.3,
            max_completion_tokens=2000,
        )
        answer = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {e}")

    return ChatResponse(answer=answer, sources=sources, tokens_used=tokens_used)


# ═══════════════════════════════════════════
# Feed / Posts endpoints
# ═══════════════════════════════════════════

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")

def _supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


class ArticlePostRequest(BaseModel):
    title: str
    content: str
    source_url: str | None = None
    journal: str | None = None
    specialty: str | None = None
    image_url: str | None = None


@app.post("/feed/articles")
def post_article(req: ArticlePostRequest):
    """Post an article to the community feed. Used by ARIA agent or staff."""
    metadata = {
        "source": "aria_agent",
        "source_url": req.source_url,
        "journal": req.journal,
        "specialty": req.specialty,
        "author_name": "ARIA",
    }
    payload = {
        "type": "article",
        "title": req.title,
        "content": req.content,
        "image_url": req.image_url,
        "metadata": metadata,
    }
    try:
        r = httpx.post(
            f"{SUPABASE_URL}/rest/v1/posts",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            json=payload,
            timeout=15,
        )
        if r.status_code in (200, 201):
            return {"status": "ok", "post": r.json()}
        raise HTTPException(status_code=500, detail=f"Supabase error: {r.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class VagaPostRequest(BaseModel):
    title: str
    content: str
    location: str | None = None
    contact: str | None = None


@app.post("/feed/vagas")
def post_vaga(req: VagaPostRequest):
    """Post a job vacancy to the community feed."""
    metadata = {
        "source": "backend",
        "author_name": "Equipe RadioeXperience",
        "location": req.location,
        "contact": req.contact,
    }
    payload = {
        "type": "vaga",
        "title": req.title,
        "content": req.content,
        "metadata": metadata,
    }
    try:
        r = httpx.post(
            f"{SUPABASE_URL}/rest/v1/posts",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            json=payload,
            timeout=15,
        )
        if r.status_code in (200, 201):
            return {"status": "ok", "post": r.json()}
        raise HTTPException(status_code=500, detail=f"Supabase error: {r.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SocialPostRequest(BaseModel):
    title: str
    content: str


class FeedPostUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    type: str | None = None
    visibility: str | None = None


@app.post("/feed/social")
def post_social(req: SocialPostRequest):
    """Post a generic social update to the community feed."""
    metadata = {
        "source": "backend",
        "author_name": "Comunidade",
    }
    payload = {
        "type": "post",
        "title": req.title,
        "content": req.content,
        "metadata": metadata,
    }
    try:
        r = httpx.post(
            f"{SUPABASE_URL}/rest/v1/posts",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            json=payload,
            timeout=15,
        )
        if r.status_code in (200, 201):
            return {"status": "ok", "post": r.json()}
        raise HTTPException(status_code=500, detail=f"Supabase error: {r.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/feed/posts")
def list_feed_posts(post_type: str | None = None, limit: int = 20):
    """List posts from the feed. Optionally filter by type."""
    params = {"select": "*", "order": "created_at.desc", "limit": str(limit)}
    if post_type:
        params["type"] = f"eq.{post_type}"
    try:
        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/posts",
            headers=_supabase_headers(),
            params=params,
            timeout=15,
        )
        return {"posts": r.json(), "count": len(r.json())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/posts/{post_id}")
def update_post(post_id: str, req: FeedPostUpdateRequest):
    payload = {k: v for k, v in req.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    try:
        r = httpx.patch(
            f"{SUPABASE_URL}/rest/v1/posts?id=eq.{post_id}",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            json=payload,
            timeout=15,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Supabase error: {r.text}")
        data = r.json() if r.text else []
        return {"status": "ok", "post": data[0] if data else None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/posts/{post_id}")
def delete_post(post_id: str):
    try:
        r = httpx.delete(
            f"{SUPABASE_URL}/rest/v1/posts?id=eq.{post_id}",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            timeout=15,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Supabase error: {r.text}")
        data = r.json() if r.text else []
        return {"status": "ok", "deleted": len(data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════
# ARIA Challenge endpoints
# ═══════════════════════════════════════════

CHALLENGE_SYSTEM_PROMPT = """Você é ARIA Challenge, um gerador de questões de radiologia. Com base no contexto abaixo, gere uma questão de múltipla escolha desafiadora e justa para radiologistas.

OBRIGATÓRIO: TODA a questão, opções, explicações e títulos devem ser em PORTUGUÊS BRASILEIRO. Nunca use inglês.

Context:
{context}

Contexto:
{context}

Regras:
1. A questão deve ser respondível APENAS com base no contexto fornecido
2. Gere 4 opções (A, B, C, D)
3. Apenas uma resposta correta
4. Inclua uma breve explicação do porquê a resposta está correta
5. Inclua também a resposta da ARIA (que é a resposta correta)
6. Retorne apenas JSON:
{{
  "question_text": "...",
  "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
  "correct_answer": "A",
  "explanation": "...",
  "source_title": "..."
}}"""


class ChallengeStartRequest(BaseModel):
    user_id: str | None = None
    specialty: str = "Geral"
    num_questions: int = 10
    time_per_question: int = 60


class ChallengeAnswerRequest(BaseModel):
    challenge_id: str
    question_id: str
    user_answer: str
    time_taken_seconds: int = 0
    user_id: str | None = None


class ChallengeFinishRequest(BaseModel):
    challenge_id: str


def _get_challenge_context(specialty: str, skip_hits: int = 0) -> str:
    """Get relevant context chunks from Qdrant for question generation.
    skip_hits causes the first N results to be skipped, producing more varied questions."""
    from qdrant_client.models import FieldCondition, MatchValue, Filter

    # Rotate search terms slightly for variety
    search_suffixes = ["diagnóstico imagem", "achados radiológicos", "critérios diagnósticos", "classificação"]
    suffix = search_suffixes[skip_hits % len(search_suffixes)]
    search_terms = f"radiologia {specialty} {suffix}"
    try:
        embedding = _embed_with_retry(search_terms)
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        return ""

    # Try with specialty filter first
    results = None
    normalized_sp = _normalize_specialty(specialty)
    if specialty and normalized_sp and normalized_sp != "geral":
        try:
            query_filter = Filter(
                must=[FieldCondition(key="specialty", match=MatchValue(value=normalized_sp))]
            )
            results = _qdrant_search_with_retry(
                collection_name=COLLECTION,
                query=embedding, limit=8, query_filter=query_filter,
            )
            if len(results.points) < 3:
                results = None  # Not enough, try without filter
        except Exception:
            results = None

    # Fallback: no specialty filter
    if results is None or len(results.points) < 3:
        try:
            results = _qdrant_search_with_retry(
                collection_name=COLLECTION,
                query=embedding, limit=8,
            )
        except Exception as e:
            logger.warning(f"Qdrant query failed: {e}")
            return ""

    context_parts = []
    for hit in results.points[:5]:
        p = hit.payload or {}
        text = p.get("text", "")[:600]
        title = p.get("title", "")
        page = p.get("page_start", 0)
        if text:
            context_parts.append(f"[Fonte: {title}, p.{page}]\n{text}")

    return "\n\n---\n\n".join(context_parts) if context_parts else ""


def _generate_question(context: str) -> dict:
    """Generate a single question from context using GPT-4o."""
    prompt = CHALLENGE_SYSTEM_PROMPT.format(context=context)
    response = openai_client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": "Gere uma questão de múltipla escolha de radiologia em PORTUGUÊS com base no contexto fornecido."},
        ],
        temperature=0.7,
        max_completion_tokens=600,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content.strip()
    data = json.loads(raw)

    # Shuffle options so correct answer isn't always the same letter
    options = data.get("options", {})
    correct_letter = data.get("correct_answer", "A")
    letters = ["A", "B", "C", "D"]
    if len(options) == 4 and all(l in options for l in letters):
        texts = [options[l] for l in letters]
        random.shuffle(texts)
        new_options = {letters[i]: texts[i] for i in range(4)}
        # Find which letter now has the correct answer
        correct_text = options[correct_letter]
        new_correct = letters[texts.index(correct_text)]
        data["options"] = new_options
        data["correct_answer"] = new_correct

    return data


def _get_seen_pool_ids(user_id: str, current_challenge_id: str | None = None) -> set:
    """Get pool question IDs the user has already answered (across all previous challenges)."""
    try:
        params = {"user_id": f"eq.{user_id}", "select": "question_id"}
        rr = httpx.get(
            f"{SUPABASE_URL}/rest/v1/challenge_responses",
            headers=_supabase_headers(),
            params=params,
            timeout=15,
        )
        if rr.status_code != 200:
            return set()
        answered_ids = [r["question_id"] for r in rr.json() if r.get("question_id")]
        if not answered_ids:
            return set()
        seen = set()
        # Batch resolve question → pool_id
        for i in range(0, len(answered_ids), 50):
            batch = answered_ids[i:i+50]
            ids_filter = ",".join(batch)
            qr = httpx.get(
                f"{SUPABASE_URL}/rest/v1/challenge_questions",
                headers=_supabase_headers(),
                params={"id": f"in.({ids_filter})", "select": "id,pool_id"},
                timeout=15,
            )
            if qr.status_code == 200:
                for q in qr.json():
                    if q.get("pool_id"):
                        seen.add(q["pool_id"])
        # Also add pool_ids from the current in-progress challenge questions
        if current_challenge_id:
            try:
                cr = httpx.get(
                    f"{SUPABASE_URL}/rest/v1/challenge_questions",
                    headers=_supabase_headers(),
                    params={"challenge_id": f"eq.{current_challenge_id}", "select": "pool_id"},
                    timeout=10,
                )
                if cr.status_code == 200:
                    for q in cr.json():
                        if q.get("pool_id"):
                            seen.add(q["pool_id"])
            except Exception:
                pass
        return seen
    except Exception as e:
        logger.warning(f"Failed to get seen pool IDs: {e}")
        return set()


def _get_pool_questions(specialty: str, num: int, exclude_ids: set, challenge_id: str | None = None) -> list:
    """Get questions from the pool, excluding already-seen ones. Prioritizes pool questions over LLM generation."""
    def _fetch_pool(specialty_filter: str | None, limit: int) -> list:
        """Helper: fetch pool questions with optional specialty filter."""
        try:
            params = {
                "select": "*",
                "order": "times_used.asc,created_at.asc",
                "limit": str(limit),
            }
            if specialty_filter:
                params["specialty"] = f"eq.{specialty_filter}"

            all_ex = set(exclude_ids)
            # Also exclude pool_ids already in this challenge (prevents duplicates within same challenge)
            if challenge_id:
                try:
                    cr = httpx.get(
                        f"{SUPABASE_URL}/rest/v1/challenge_questions",
                        headers=_supabase_headers(),
                        params={"challenge_id": f"eq.{challenge_id}", "select": "pool_id"},
                        timeout=10,
                    )
                    if cr.status_code == 200:
                        for q in cr.json():
                            if q.get("pool_id"):
                                all_ex.add(q["pool_id"])
                except Exception:
                    pass
            if all_ex:
                ids_str = ",".join(all_ex)
                params["id"] = f"not.in.({ids_str})"

            r = httpx.get(
                f"{SUPABASE_URL}/rest/v1/challenge_question_pool",
                headers=_supabase_headers(),
                params=params,
                timeout=15,
            )
            if r.status_code == 200:
                return r.json()
            return []
        except Exception as e:
            logger.warning(f"Pool fetch failed: {e}")
            return []

    # Normalize specialty
    normalized = specialty.lower().strip() if specialty else "geral"

    # Step 1: try specific specialty (use capitalized specialty name for DB match)
    db_specialty = specialty.strip() if specialty else None
    questions = _fetch_pool(db_specialty if normalized != "geral" else None, num * 3)
    logger.info(f"Pool step 1 ({db_specialty if normalized != 'geral' else 'Geral'}): {len(questions)} questions")

    # Step 2: if not enough and not "Geral", try "Geral" to fill the gap
    if len(questions) < num and normalized != "geral":
        geral_qs = _fetch_pool("Geral", (num - len(questions)) * 2)
        logger.info(f"Pool step 2 (Geral): {len(geral_qs)} questions")
        existing_ids = {q["id"] for q in questions}
        for gq in geral_qs:
            if gq["id"] not in existing_ids:
                questions.append(gq)
                existing_ids.add(gq["id"])

    return questions[:num]

def _save_to_pool(specialty: str, q_data: dict):
    """Save a generated question to the pool for reuse."""
    try:
        pool_payload = {
            "specialty": specialty,
            "question_text": q_data.get("question_text", ""),
            "question_type": "multiple_choice",
            "options": q_data.get("options", {}),
            "correct_answer": q_data.get("correct_answer", ""),
            "explanation": q_data.get("explanation", ""),
            "source_title": q_data.get("source_title", ""),
            "difficulty": "medium",
            "times_used": 0,
        }
        httpx.post(
            f"{SUPABASE_URL}/rest/v1/challenge_question_pool",
            headers={**_supabase_headers(), "Prefer": "return=minimal"},
            json=pool_payload,
            timeout=15,
        )
    except Exception as e:
        logger.warning(f"Failed to save to pool: {e}")


def _copy_pool_to_challenge(challenge_id: str, pool_q: dict, question_number: int) -> dict | None:
    """Copy a pool question into challenge_questions for a specific challenge."""
    try:
        q_payload = {
            "challenge_id": challenge_id,
            "question_number": question_number,
            "question_text": pool_q["question_text"],
            "question_type": pool_q.get("question_type", "multiple_choice"),
            "options": pool_q["options"],
            "correct_answer": pool_q["correct_answer"],
            "ai_answer": pool_q["correct_answer"],
            "explanation": pool_q.get("explanation", ""),
            "source_title": pool_q.get("source_title", ""),
            "pool_id": pool_q["id"],
            "image_base64": pool_q.get("image_base64"),
            "has_image": pool_q.get("has_image", False),
        }
        qr = httpx.post(
            f"{SUPABASE_URL}/rest/v1/challenge_questions",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            json=q_payload,
            timeout=15,
        )
        if qr.status_code in (200, 201):
            saved = qr.json()[0]
            try:
                httpx.patch(
                    f"{SUPABASE_URL}/rest/v1/challenge_question_pool?id=eq.{pool_q['id']}",
                    headers={**_supabase_headers(), "Prefer": "return=minimal"},
                    json={"times_used": (pool_q.get("times_used", 0) or 0) + 1},
                    timeout=10,
                )
            except Exception:
                pass
            return saved
        return None
    except Exception as e:
        logger.warning(f"Failed to copy pool question: {e}")
        return None


@app.post("/challenge/start")
def challenge_start(req: ChallengeStartRequest):
    """Create a new challenge using question pool (with GPT-4o fallback)."""
    import random
    user_id = req.user_id or str(uuid.uuid4())
    challenge_payload = {
        "user_id": user_id,
        "specialty": req.specialty,
        "num_questions": req.num_questions,
        "time_per_question": req.time_per_question,
        "status": "in_progress",
    }
    try:
        r = httpx.post(
            f"{SUPABASE_URL}/rest/v1/challenges",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            json=challenge_payload,
            timeout=15,
        )
        if r.status_code not in (200, 201):
            raise HTTPException(status_code=500, detail=f"Failed to create challenge: {r.text}")
        challenge = r.json()[0]
        challenge_id = challenge["id"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Challenge creation error: {str(e)}")
    seen_ids = _get_seen_pool_ids(user_id, challenge_id)
    logger.info(f"Challenge start: user={user_id[:8]}... seen={len(seen_ids)} pool questions")
    logger.info(f"Using SUPABASE_URL: {SUPABASE_URL}")
    pool_questions = _get_pool_questions(req.specialty, req.num_questions, seen_ids, challenge_id)
    logger.info(f"Pool returned {len(pool_questions)} questions for {req.specialty}")
    questions_to_use = list(pool_questions)
    generated_count = 0
    if len(questions_to_use) < req.num_questions:
        needed = req.num_questions - len(questions_to_use)
        logger.info(f"Generating {needed} new questions with GPT-4o")
        for i in range(needed):
            try:
                context = _get_challenge_context(req.specialty, skip_hits=i)
                if not context:
                    logger.warning(f"No context for new question {i+1}, skipping")
                    continue
                q_data = _generate_question(context)
                _save_to_pool(req.specialty, q_data)
                q_data["_generated"] = True
                questions_to_use.append(q_data)
                generated_count += 1
            except Exception as e:
                logger.warning(f"Failed to generate question {i+1}: {e} | context_len={len(context) if context else 0}")
                continue
    logger.info(f"Total questions to use: {len(questions_to_use)} (pool: {len(pool_questions)}, generated: {generated_count})")
    random.shuffle(questions_to_use)
    questions = []
    copy_errors = []
    for i, q in enumerate(questions_to_use[:req.num_questions]):
        try:
            if q.get("_generated"):
                q_payload = {
                    "challenge_id": challenge_id,
                    "question_number": i + 1,
                    "question_text": q.get("question_text", ""),
                    "question_type": "multiple_choice",
                    "options": q.get("options", {}),
                    "correct_answer": q.get("correct_answer", ""),
                    "ai_answer": q.get("correct_answer", ""),
                    "explanation": q.get("explanation", ""),
                    "source_title": q.get("source_title", ""),
                }
                qr = httpx.post(
                    f"{SUPABASE_URL}/rest/v1/challenge_questions",
                    headers={**_supabase_headers(), "Prefer": "return=representation"},
                    json=q_payload,
                    timeout=15,
                )
                if qr.status_code in (200, 201):
                    saved_q = qr.json()[0]
                    questions.append({
                        "id": saved_q["id"],
                        "question_number": saved_q["question_number"],
                        "question_text": saved_q["question_text"],
                        "question_type": saved_q["question_type"],
                        "options": saved_q["options"],
                        "image_base64": saved_q.get("image_base64"),
                        "has_image": saved_q.get("has_image", False),
                        "time_per_question": req.time_per_question,
                    })
                else:
                    logger.warning(f"Failed to insert generated question: {qr.status_code} {qr.text[:200]}")
            else:
                saved = _copy_pool_to_challenge(challenge_id, q, i + 1)
                if saved:
                    questions.append({
                        "id": saved["id"],
                        "question_number": saved["question_number"],
                        "question_text": saved["question_text"],
                        "question_type": saved["question_type"],
                        "options": saved["options"],
                        "image_base64": saved.get("image_base64"),
                        "has_image": saved.get("has_image", False),
                        "time_per_question": req.time_per_question,
                    })
                else:
                    copy_errors.append(i + 1)
        except Exception as e:
            logger.warning(f"Failed to save question {i+1}: {e}")
            continue
    if not questions:
        detail = "Could not prepare questions"
        if copy_errors:
            detail += f" (copy errors at questions: {copy_errors})"
        raise HTTPException(status_code=500, detail=detail)
    return {
        "challenge_id": challenge_id,
        "questions": questions,
    }


@app.post("/challenge/answer")
def challenge_answer(req: ChallengeAnswerRequest):
    """Submit an answer to a challenge question."""
    # Get the question from Supabase
    try:
        qr = httpx.get(
            f"{SUPABASE_URL}/rest/v1/challenge_questions",
            headers=_supabase_headers(),
            params={"id": f"eq.{req.question_id}", "select": "*"},
            timeout=15,
        )
        if qr.status_code != 200 or not qr.json():
            raise HTTPException(status_code=404, detail="Question not found")
        question = qr.json()[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching question: {str(e)}")

    # Check answer (case-insensitive)
    correct = question["correct_answer"].strip().upper() == req.user_answer.strip().upper()

    # Calculate points
    base_points = 100 if correct else 0
    time_limit = question.get("time_per_question", 60) or 60
    # Speed bonus: up to 50 points for fast answers
    if correct and req.time_taken_seconds > 0:
        speed_ratio = max(0, 1 - (req.time_taken_seconds / time_limit))
        speed_bonus = int(50 * speed_ratio)
    else:
        speed_bonus = 0
    points_earned = base_points + speed_bonus

    # Store response
    response_payload = {
        "question_id": req.question_id,
        "challenge_id": req.challenge_id,
        "user_id": req.user_id or str(uuid.uuid4()),
        "user_answer": req.user_answer,
        "time_taken_seconds": req.time_taken_seconds,
        "is_correct": correct,
        "points_earned": points_earned,
    }

    try:
        httpx.post(
            f"{SUPABASE_URL}/rest/v1/challenge_responses",
            headers={**_supabase_headers(), "Prefer": "return=minimal"},
            json=response_payload,
            timeout=15,
        )
    except Exception as e:
        logger.warning(f"Failed to save response: {e}")

    # Update challenge scores
    try:
        # Get current scores
        cr = httpx.get(
            f"{SUPABASE_URL}/rest/v1/challenges",
            headers=_supabase_headers(),
            params={"id": f"eq.{req.challenge_id}", "select": "user_score,ai_score,total_time_seconds"},
            timeout=15,
        )
        if cr.status_code == 200 and cr.json():
            ch = cr.json()[0]
            new_user_score = (ch.get("user_score") or 0) + points_earned
            # AI always gets 100 base (it knows the answer)
            new_ai_score = (ch.get("ai_score") or 0) + 100
            new_total_time = (ch.get("total_time_seconds") or 0) + req.time_taken_seconds

            httpx.patch(
                f"{SUPABASE_URL}/rest/v1/challenges?id=eq.{req.challenge_id}",
                headers={**_supabase_headers(), "Prefer": "return=minimal"},
                json={
                    "user_score": new_user_score,
                    "ai_score": new_ai_score,
                    "total_time_seconds": new_total_time,
                },
                timeout=15,
            )
        else:
            new_user_score = points_earned
            new_ai_score = 100
    except Exception as e:
        logger.warning(f"Failed to update challenge scores: {e}")
        new_user_score = points_earned
        new_ai_score = 100

    return {
        "is_correct": correct,
        "correct_answer": question["correct_answer"],
        "ai_answer": question.get("ai_answer", question["correct_answer"]),
        "explanation": question.get("explanation", ""),
        "points_earned": points_earned,
        "user_score": new_user_score,
        "ai_score": new_ai_score,
    }


@app.post("/challenge/finish")
def challenge_finish(req: ChallengeFinishRequest):
    """Finish a challenge and return final results."""
    # Update challenge status
    try:
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/challenges?id=eq.{req.challenge_id}",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            json={"status": "finished", "finished_at": datetime.now(timezone.utc).isoformat()},
            timeout=15,
        )
    except Exception as e:
        logger.warning(f"Failed to finish challenge: {e}")

    # Get challenge details
    try:
        cr = httpx.get(
            f"{SUPABASE_URL}/rest/v1/challenges",
            headers=_supabase_headers(),
            params={"id": f"eq.{req.challenge_id}", "select": "*"},
            timeout=15,
        )
        challenge = cr.json()[0] if cr.status_code == 200 and cr.json() else {}
    except Exception:
        challenge = {}

    # Get all questions and responses
    try:
        qr = httpx.get(
            f"{SUPABASE_URL}/rest/v1/challenge_questions",
            headers=_supabase_headers(),
            params={"challenge_id": f"eq.{req.challenge_id}", "select": "*", "order": "question_number.asc"},
            timeout=15,
        )
        questions = qr.json() if qr.status_code == 200 else []

        rr = httpx.get(
            f"{SUPABASE_URL}/rest/v1/challenge_responses",
            headers=_supabase_headers(),
            params={"challenge_id": f"eq.{req.challenge_id}", "select": "*"},
            timeout=15,
        )
        responses = rr.json() if rr.status_code == 200 else []
    except Exception:
        questions = []
        responses = []

    # Build detail list
    resp_map = {r["question_id"]: r for r in responses}
    questions_detail = []
    for q in questions:
        resp = resp_map.get(q["id"], {})
        questions_detail.append({
            "question_number": q["question_number"],
            "question_text": q["question_text"],
            "options": q["options"],
            "correct_answer": q["correct_answer"],
            "ai_answer": q.get("ai_answer", q["correct_answer"]),
            "user_answer": resp.get("user_answer"),
            "is_correct": resp.get("is_correct", False),
            "time_taken_seconds": resp.get("time_taken_seconds", 0),
            "points_earned": resp.get("points_earned", 0),
            "explanation": q.get("explanation", ""),
        })

    return {
        "challenge_id": req.challenge_id,
        "user_score": challenge.get("user_score", 0),
        "ai_score": challenge.get("ai_score", 0),
        "total_time": challenge.get("total_time_seconds", 0),
        "questions_detail": questions_detail,
    }


@app.get("/challenge/leaderboard")
def challenge_leaderboard(specialty: str | None = None, period: str = "weekly", limit: int = 20):
    """Get challenge leaderboard with period filter (weekly/monthly/all)."""
    from datetime import timedelta
    params = {
        "select": "id,user_id,specialty,user_score,ai_score,num_questions,total_time_seconds,created_at",
        "status": "eq.finished",
        "order": "user_score.desc,total_time_seconds.asc",
        "limit": str(min(limit * 5, 200)),
    }
    if specialty:
        params["specialty"] = f"eq.{specialty}"
    # Date filter
    if period == "weekly":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        params["created_at"] = f"gte.{cutoff}"
    elif period == "monthly":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        params["created_at"] = f"gte.{cutoff}"
    # period == "all" -> no date filter
    try:
        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/challenges",
            headers=_supabase_headers(),
            params=params,
            timeout=15,
        )
        if r.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Supabase error: {r.text}")
        challenges = r.json()
        # Aggregate by user_id
        from collections import defaultdict
        user_stats = defaultdict(lambda: {"best_score": 0, "scores": [], "total": 0, "specialties": set(), "last_date": ""})
        for c in challenges:
            uid = c.get("user_id", "unknown")
            s = user_stats[uid]
            s["best_score"] = max(s["best_score"], c.get("user_score", 0))
            s["scores"].append(c.get("user_score", 0))
            s["total"] += 1
            if c.get("specialty"):
                s["specialties"].add(c["specialty"])
            if c.get("created_at", "") > s["last_date"]:
                s["last_date"] = c["created_at"]
        # Fetch user names from profiles
        user_names = {}
        unique_uids = list(user_stats.keys())
        for uid in unique_uids:
            try:
                pr = httpx.get(
                    f"{SUPABASE_URL}/rest/v1/profiles",
                    headers=_supabase_headers(),
                    params={"select": "id,full_name", "id": f"eq.{uid}"},
                    timeout=5,
                )
                if pr.status_code == 200 and pr.json():
                    user_names[uid] = pr.json()[0].get("full_name") or f"Jogador {uid[:4].upper()}"
                else:
                    user_names[uid] = f"Jogador {uid[:4].upper()}"
            except Exception:
                user_names[uid] = f"Jogador {uid[:4].upper()}"

        rankings = []
        for uid, s in user_stats.items():
            rankings.append({
                "user_id": uid,
                "user_name": user_names.get(uid, f"Jogador {uid[:4].upper()}"),
                "best_score": s["best_score"],
                "avg_score": round(sum(s["scores"]) / len(s["scores"]), 1),
                "total_challenges": s["total"],
                "specialty": ", ".join(list(s["specialties"])[:3]) or "Geral",
                "last_challenge": s["last_date"],
            })
        rankings.sort(key=lambda x: (-x["best_score"], -x["total_challenges"]))
        for i, r_item in enumerate(rankings[:limit]):
            r_item["rank"] = i + 1
        return {"rankings": rankings[:limit], "period": period, "total_players": len(user_stats)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/challenge/history")
def challenge_history(user_id: str | None = None):
    """Get user's challenge history."""
    params = {
        "select": "*",
        "order": "created_at.desc",
        "limit": "50",
    }
    if user_id:
        params["user_id"] = f"eq.{user_id}"

    try:
        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/challenges",
            headers=_supabase_headers(),
            params=params,
            timeout=15,
        )
        if r.status_code == 200:
            return {"challenges": r.json(), "count": len(r.json())}
        raise HTTPException(status_code=500, detail=f"Supabase error: {r.text}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# -- eX StudyLab: Modulo Criar -------------------------------------------------

class CriarRequest(BaseModel):
    topic: str
    template: str  # script | slides | mapa_mental | tabela | questoes | caso_clinico
    specialty: str | None = None
    level: str | None = None  # R1 | R2 | R3 | R4 | staff
    top_k: int = 10

CRIAR_PROMPTS = {
    "script": {
        "system": """Você é um especialista em educação médica em radiologia. Crie um SCRIPT DE AULA completo e estruturado sobre o tema fornecido.

Use o contexto RAG fornecido como base científica. O script deve seguir esta estrutura:

## 🎯 Hook (30 segundos)
[Abertura envolvente com caso clínico ou dado surpreendente]

## 📚 Desenvolvimento
[Conceitos fundamentais, classificações, critérios diagnósticos por modalidade]

## 🩺 Caso Clínico Integrado
[Caso real/anonimizado que ilustra os conceitos]

## ✅ Pontos-Chave
[Resumo em bullet points dos takeaways principais]

Regras obrigatórias:
- NÃO coloque um título inicial como `# {topic}` ou qualquer heading antes de `## 🎯 Hook (30 segundos)`
- NÃO inclua seção de referências
- NÃO inclua bibliografia, fontes, links ou bloco final de leitura adicional

Seja preciso cientificamente, use terminologia adequada e inclua critérios de imagem quando relevante. Escreva em português brasileiro.""",
        "label": "Script de Aula",
        "credits": 50,
    },
    "slides": {
        "system": """Você é um especialista em educação médica em radiologia. Crie um conjunto de SLIDES DIDÁTICOS sobre o tema fornecido.

Use o contexto RAG fornecido como base científica. Formate como:

## SLIDE 1 – Título
**{topic}**
[Subtítulo / contexto]

## SLIDE 2 – Objetivos
- Objetivo 1
- Objetivo 2
- Objetivo 3

## SLIDES 3-8 – Conteúdo
[Cada slide com título claro e 3-5 bullet points máx. Inclua tabelas comparativas quando relevante]

## SLIDE Final – Take-Home Points
- Resumo dos pontos-chave
- Aplicação clínica prática

Mínimo 6 slides, máximo 12. Cada slide deve ser autocontido e visualmente descritivo. Português brasileiro.""",
        "label": "Slides Didáticos",
        "credits": 80,
    },
    "mapa_mental": {
        "system": """Você é um especialista em educação médica em radiologia. Crie um MAPA MENTAL HIERÁRQUICO sobre o tema fornecido.

Use o contexto RAG fornecido como base científica. Formate como árvore hierárquica em markdown:

# {topic}

## Ramo 1: [Categoria Principal]
### 1.1 [Subcategoria]
- Característica / achado 1
- Característica / achado 2
### 1.2 [Subcategoria]
- Critério A
- Critério B

## Ramo 2: [Categoria Principal]
...

## Ramo 3: Diagnóstico Diferencial
...

## Ramo 4: Conduta / Classificação
...

Organize de forma lógica: definição → classificação → achados por modalidade → diagnóstico diferencial → conduta. Use no máximo 4 níveis de hierarquia. Português brasileiro.""",
        "label": "Mapa Mental",
        "credits": 60,
    },
    "tabela": {
        "system": """Você é um especialista em educação médica em radiologia. Crie uma TABELA COMPARATIVA detalhada sobre o tema fornecido.

Use o contexto RAG fornecido como base científica. Formate em markdown table:

# Tabela Comparativa: {topic}

## Por Modalidade de Imagem
| Característica | Ultrassonografia | Tomografia | Ressonância Magnética |
|---|---|---|---|
| [critério 1] | [achado] | [achado] | [achado] |
| [critério 2] | [achado] | [achado] | [achado] |

## Classificação / Estadiamento (se aplicável)
| Categoria | Critérios | Conduta |
|---|---|---|
| ... | ... | ... |

## Diagnóstico Diferencial
| Diagnóstico | Achado Característico | Diferencial Principal |
|---|---|---|
| ... | ... | ... |

Inclua BIRADS, TI-RADS, LI-RADS ou outra classificação relevante quando aplicável. Seja conciso e clinicamente útil. Português brasileiro.""",
        "label": "Tabela Comparativa",
        "credits": 60,
    },
    "questoes": {
        "system": """Você é um especialista em educação médica em radiologia. Crie 5 QUESTÕES DE MÚLTIPLA ESCOLHA sobre o tema fornecido.

Use o contexto RAG fornecido como base científica. Formate cada questão assim:

**QUESTÃO 1:**
[Enunciado clínico com contexto de caso]

A) [Alternativa]
B) [Alternativa]
C) [Alternativa]
D) [Alternativa]

**Resposta Correta:** [Letra]

**Explicação:**
[Explicação detalhada de por que a resposta está correta e por que as outras estão erradas]

**Fonte:** [Referência bibliográfica]

Regras:
- Cada questão deve ter exatamente 4 alternativas (A-D)
- Apenas UMA alternativa correta
- Enunciado deve ser no formato de caso clínico quando possível
- Explicações devem ser educativas e detalhadas
- Alternativas erradas devem ser plausíveis (distratores de qualidade)
- Português brasileiro""",
        "label": "Questões de Estudo",
        "credits": 30,
    },
    "caso_clinico": {
        "system": """Você é um especialista em educação médica em radiologia. Crie um CASO CLÍNICO COMPLETO para apresentação acadêmica sobre o tema fornecido.

Use o contexto RAG fornecido como base científica. Formate assim:

# Caso Clínico: {topic}

## 📋 Anamnese
- **Idade/Sexo:** [dados]
- **Queixa principal:** [sintomas]
- **História da doença atual:** [evolução]
- **Antecedentes relevantes:** [comorbidades, cirurgias prévias]

## 🩺 Exame Físico
[Achados relevantes ao exame físico]

## 🔬 Exames de Imagem
### Modalidade 1 (US/TC/RX/RM)
**Técnica:** [protocolo utilizado]
**Achados:**
- [Descrição detalhada dos achados]
- [Medidas, características, padrões]

### Modalidade 2 (se aplicável)
[...]

## 💬 Discussão
[Análise dos achados, diagnóstico diferencial, critérios diagnósticos]

## ✅ Diagnóstico Final
[Diagnóstico definitivo com classificação]

## 📖 Referências
[Fontes bibliográficas]

Seja cientificamente rigoroso e use terminologia adequada. Português brasileiro.""",
        "label": "Caso Clínico",
        "credits": 100,
    },
}


import re as _re

def _clean_generated_content(content: str) -> str:
    """Remove common boilerplate that GPT models add at the end of generated content."""
    patterns = [
        r"Se quiser,?\s*posso transformar.*?(?:\n|$)",
        r"Se desejar,?\s*posso.*?(?:\n|$)",
        r"Gostaria que eu.*?(?:\n|$)",
        r"Posso também.*?(?:transformar|criar|fazer).*?(?:\n|$)",
        r"Deseja que eu.*?(?:\n|$)",
    ]
    for pattern in patterns:
        content = _re.sub(pattern, "", content, flags=_re.IGNORECASE)
    return content.strip()


def _clean_script_content(content: str, topic: str) -> str:
    """Remove title headings and references from script outputs."""
    cleaned = content.strip()

    heading_patterns = [
        rf"^#\s*{_re.escape(topic)}\s*\n+",
        rf"^#\s*{_re.escape(topic.rstrip(' .:;-'))}[ .:;-]*\n+",
        r"^#\s*.+?\n+(?=##)",
    ]
    for pattern in heading_patterns:
        cleaned = _re.sub(pattern, "", cleaned, flags=_re.IGNORECASE)

    cleaned = _re.sub(
        r"\n*##\s*(?:📖\s*)?(?:Refer[eê]ncias?|Bibliografia|Fontes?|Leitura adicional)\s*[\s\S]*$",
        "",
        cleaned,
        flags=_re.IGNORECASE,
    )

    cleaned = _re.sub(
        r"\n*(?:Refer[eê]ncias?|Bibliografia|Fontes?|Leitura adicional):\s*[\s\S]*$",
        "",
        cleaned,
        flags=_re.IGNORECASE,
    )

    return cleaned.strip()


# ── Specialty normalization (frontend -> Qdrant lowercase) ───────────────────
SPECIALTY_NORMALIZE = {
    "mama": "mama",
    "abdome": "abdome",
    "tórax": "torax",
    "torax": "torax",
    "neuroimagem": "neurorradiologia",
    "neurorradiologia": "neurorradiologia",
    "músculo esquelético": "msk",
    "musculo esquelético": "msk",
    "msk": "msk",
    "pediatria": "pediatria",
    "urgência": "urgência",
    "vascular": "vascular",
    "obstetrícia": "obstetrícia",
    "cabeça e pescoço": "cabeca/pescoco",
    "cabeca e pescoco": "cabeca/pescoco",
    "cabeca/pescoco": "cabeca/pescoco",
    "radioprotecao": "radioprotecao",
    "intervencao": "intervencao",
    "geral": "geral",
    "Geral": "geral",
}


def _normalize_specialty(specialty: str | None) -> str | None:
    if not specialty:
        return None
    return SPECIALTY_NORMALIZE.get(specialty.lower().strip(), specialty.lower().strip())


@app.post("/criar/{template_type}")
def criar_content(template_type: str, req: CriarRequest):
    """Gera conteúdo para o eX StudyLab usando RAG + GPT-4o."""
    if template_type not in CRIAR_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Template inválido. Use: {', '.join(CRIAR_PROMPTS.keys())}")

    prompt_config = CRIAR_PROMPTS[template_type]
    system_prompt = prompt_config["system"].replace("{topic}", req.topic)

    # 1. Search RAG for context
    try:
        embedding = _embed_with_retry(req.topic)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro de embedding: {e}")

    query_filter = None
    if req.specialty:
        from qdrant_client.models import FieldCondition, MatchValue, Filter
        normalized_sp = _normalize_specialty(req.specialty)
        query_filter = Filter(
            must=[FieldCondition(key="specialty", match=MatchValue(value=normalized_sp))]
        )

    try:
        results = _qdrant_search_with_retry(
            collection_name=COLLECTION,
            query=embedding,
            limit=req.top_k,
            with_payload=True,
            query_filter=query_filter,
        )
        context_chunks = []
        for pt in results.points:
            payload = pt.payload or {}
            text = payload.get("text", payload.get("content", ""))
            source = payload.get("source", payload.get("title", ""))
            if text:
                context_chunks.append(f"[Fonte: {source}]\n{text[:800]}")
        context_text = "\n\n---\n\n".join(context_chunks[:8])
    except Exception as e:
        logger.warning(f"Qdrant search failed for criar: {e}")
        context_text = "Contexto RAG indisponível no momento."

    # 2. Generate with GPT-4o
    try:
        response = openai_client.chat.completions.create(
            model="gpt-5.4-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Tema: {req.topic}\n\n{f'Nível: {req.level}' if req.level else ''}\n{f'Especialidade: {req.specialty}' if req.specialty else ''}\n\nContexto científico disponível:\n{context_text}"},
            ],
            temperature=0.7,
            max_completion_tokens=4000,
        )
        content = response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na geracao: {e}")

    content = _clean_generated_content(content)
    if template_type == "script":
        content = _clean_script_content(content, req.topic)

    # Generate image for visual templates (slides only — mapa_mental uses markmap on frontend)
    image_url = None
    if template_type == "slides":
        image_url = generate_image_for_content(req.topic, content, template_type)

    return {
        "content": content,
        "template": template_type,
        "label": prompt_config["label"],
        "credits": prompt_config["credits"],
        "sources_count": len(context_chunks),
        "image_url": image_url,
    }


def generate_image_for_content(topic: str, content: str, template_type: str) -> str | None:
    """Generate an image using gpt-image-1.5 for visual content types."""
    image_prompts = {
        "mapa_mental": f"Crie um mapa mental visual profissional sobre radiologia: {topic}. Use hierarquia clara com ramos coloridos, ícones médicos (raio-X, ultrassom, ressonância), e texto legível. Fundo escuro (#001a2b), cores vibrantes. Estudo médico brasileiro.",
        "slides": f"Crie uma imagem de slide didático de radiologia sobre: {topic}. Título grande no topo, 4-5 bullet points visuais com ícones, gráficos simples. Fundo escuro profissional, cores azul e verde. Formato apresentação médica.",
    }
    prompt = image_prompts.get(template_type)
    if not prompt:
        return None
    try:
        response = openai_client.images.generate(
            model="gpt-image-1.5",
            prompt=prompt,
            n=1,
            size="1536x1024",
            quality="medium",
        )
        import base64
        image_base64 = response.data[0].b64_json
        if image_base64:
            return f"data:image/png;base64,{image_base64}"
        url = response.data[0].url
        return url
    except Exception as e:
        logger.warning(f"Image generation failed: {e}")
        return None

# ── ARIA Chat Sync: Sessions ────────────────────────────────────────────────

class ChatSessionCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str | None = Field(default=None, max_length=200)

class ChatSessionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)

@app.get("/chat-sessions")
async def list_chat_sessions(authorization: str = None):
    """Lista sessões do usuário logado (máximo 5, ordenadas por updated_at)."""
    user = await verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")

    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase não configurado")

    client = await get_http_client()
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Range": "0-49",  # max 5 sessions, each with 1 row
    }

    try:
        resp = await client.get(
            f"{supabase_url}/rest/v1/aria_chat_sessions"
            f"?user_id=eq.{user['id']}&order=updated_at.desc&limit=5",
            headers=headers,
        )
        if resp.status_code == 200:
            return resp.json()
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat-sessions")
async def create_chat_session(req: ChatSessionCreateRequest, authorization: str = None):
    """Cria uma nova sessão. Se o usuário já tiver 5, a mais antiga é deletada (trigger no banco)."""
    user = await verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")

    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase não configurado")

    title = req.title or "Nova conversa"
    client = await get_http_client()
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    try:
        resp = await client.post(
            f"{supabase_url}/rest/v1/aria_chat_sessions",
            headers=headers,
            json={"user_id": user["id"], "title": title},
        )
        if resp.status_code in (200, 201):
            result = resp.json()
            # Support single-object or array response from PostgREST
            if isinstance(result, list):
                return result[0]
            return result
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/chat-sessions/{session_id}")
async def update_chat_session(session_id: str, req: ChatSessionUpdateRequest, authorization: str = None):
    """Renomeia uma sessão (título)."""
    user = await verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")

    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase não configurado")

    client = await get_http_client()
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    body = {}
    if req.title is not None:
        body["title"] = req.title

    try:
        resp = await client.patch(
            f"{supabase_url}/rest/v1/aria_chat_sessions?id=eq.{session_id}&user_id=eq.{user['id']}",
            headers=headers,
            json=body,
        )
        if resp.status_code in (200, 204):
            return {"ok": True}
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/chat-sessions/{session_id}")
async def delete_chat_session(session_id: str, authorization: str = None):
    """Deleta uma sessão e todas as suas mensagens."""
    user = await verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")

    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase não configurado")

    client = await get_http_client()
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }

    try:
        resp = await client.delete(
            f"{supabase_url}/rest/v1/aria_chat_sessions?id=eq.{session_id}&user_id=eq.{user['id']}",
            headers=headers,
        )
        if resp.status_code in (200, 204):
            return {"ok": True}
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── ARIA Chat Sync: Messages ──────────────────────────────────────────────────

class ChatMessageCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    session_id: str = Field(..., max_length=64)
    role: str = Field(..., pattern="^(user|bot)$")
    text: str = Field(..., max_length=10000)
    image_b64: str | None = Field(default=None, max_length=10_000_000)
    sources: list | None = Field(default=None)
    tokens_used: int | None = Field(default=None)


@app.get("/chat-sessions/{session_id}/messages")
async def list_chat_messages(session_id: str, authorization: str = None):
    """Lista mensagens de uma sessão (para carregar histórico)."""
    user = await verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")

    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase não configurado")

    client = await get_http_client()
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }

    try:
        resp = await client.get(
            f"{supabase_url}/rest/v1/aria_chat_messages"
            f"?session_id=eq.{session_id}&order=created_at.asc",
            headers=headers,
        )
        if resp.status_code == 200:
            return resp.json()
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat-messages")
async def create_chat_message(req: ChatMessageCreateRequest, authorization: str = None):
    """Salva uma mensagem no banco."""
    user = await verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")

    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase não configurado")

    client = await get_http_client()
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    # Verify session ownership
    session_resp = await client.get(
        f"{supabase_url}/rest/v1/aria_chat_sessions"
        f"?id=eq.{req.session_id}&user_id=eq.{user['id']}&select=id",
        headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"},
    )
    if session_resp.status_code != 200 or not session_resp.json():
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    # Update session's updated_at timestamp
    await client.patch(
        f"{supabase_url}/rest/v1/aria_chat_sessions?id=eq.{req.session_id}",
        headers=headers,
        json={"updated_at": datetime.now(timezone.utc).isoformat()},
    )

    try:
        resp = await client.post(
            f"{supabase_url}/rest/v1/aria_chat_messages",
            headers=headers,
            json={
                "session_id": req.session_id,
                "role": req.role,
                "text": req.text,
                "image_b64": req.image_b64,
                "sources": req.sources,
                "tokens_used": req.tokens_used,
            },
        )
        if resp.status_code in (200, 201):
            result = resp.json()
            if isinstance(result, list):
                return result[0]
            return result
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
