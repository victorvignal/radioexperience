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
import io
import hashlib
from datetime import datetime, timezone
import uuid
import threading
import re
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import logging
import httpx

try:
    from PyPDF2 import PdfReader
    HAS_PDF2 = True
except ImportError:
    HAS_PDF2 = False
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        HAS_PDFMINER = True
    except ImportError:
        HAS_PDFMINER = False

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

# ── Upload Progress Tracker ──
upload_progress: dict[str, dict] = {}


def _normalize_shift_value(value: str | None) -> str:
    if value is None:
        return ""
    normalized = str(value).strip().upper()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def _normalize_time_slot(value: str | None) -> str:
    normalized = _normalize_shift_value(value)
    normalized = normalized.replace(" ÀS ", "-")
    normalized = normalized.replace(" AS ", "-")
    normalized = normalized.replace("–", "-")
    normalized = normalized.replace("—", "-")
    normalized = normalized.replace(" ", "")
    return normalized


def build_shift_identity_key(shift: dict) -> str:
    parts = [
        _normalize_shift_value(shift.get("location")),
        _normalize_shift_value(shift.get("room")),
        _normalize_shift_value(shift.get("day_of_week")),
        _normalize_time_slot(shift.get("time_slot")),
        _normalize_shift_value(shift.get("specialty") or "USG"),
    ]
    raw_key = "|".join(parts)
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def prepare_shift_payload(shift: dict, source_batch_id: str, seen_at_iso: str) -> dict:
    payload = {
        "location": (shift.get("location") or "").strip(),
        "room": ((shift.get("room") or "").strip() or None),
        "day_of_week": _normalize_shift_value(shift.get("day_of_week")),
        "time_slot": ((shift.get("time_slot") or "").strip() or None),
        "doctor_name": ((shift.get("doctor_name") or "").strip() or None),
        "status": (shift.get("status") or "available").strip().lower(),
        "specialty": ((shift.get("specialty") or "USG").strip() or "USG"),
        "is_active": True,
        "last_seen_at": seen_at_iso,
        "closed_at": None,
        "source_batch_id": source_batch_id,
        "updated_at": seen_at_iso,
    }
    payload["identity_key"] = build_shift_identity_key(payload)
    return payload


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> list[dict]:
    """Extract text from PDF bytes, returning list of {page_num, text}."""
    pages = []
    if HAS_PDF2:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for i, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            pages.append({"page_num": i, "text": text.strip()})
    elif HAS_PDFMINER:
        full_text = pdfminer_extract(io.BytesIO(pdf_bytes))
        parts = full_text.split("\f")
        for i, part in enumerate(parts, 1):
            pages.append({"page_num": i, "text": part.strip()})
    else:
        raise RuntimeError("Nenhuma biblioteca PDF disponivel. Instale PyPDF2 ou pdfminer.six.")
    return pages


def chunk_text(text: str, chunk_size: int = 700, overlap: int = 100) -> list[str]:
    """Split text into chunks of ~chunk_size tokens with overlap."""
    max_chars = chunk_size * 4
    overlap_chars = overlap * 4
    if len(text) <= max_chars:
        return [text] if text.strip() else []
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += max_chars - overlap_chars
    return chunks


def _process_upload(doc_id: str, file_bytes: bytes, filename: str, metadata: dict):
    """Background task: extract text, chunk, embed, store in Qdrant."""
    try:
        upload_progress[doc_id]["status"] = "extracting"
        upload_progress[doc_id]["progress"] = 10

        file_lower = filename.lower()
        if file_lower.endswith(".pdf"):
            pages = extract_text_from_pdf_bytes(file_bytes)
        elif file_lower.endswith(".txt"):
            text = file_bytes.decode("utf-8", errors="replace")
            pages = [{"page_num": 1, "text": text}]
        elif file_lower.endswith(".md"):
            text = file_bytes.decode("utf-8", errors="replace")
            pages = [{"page_num": 1, "text": text}]
        else:
            raise ValueError(f"Formato nao suportado: {filename}")

        upload_progress[doc_id]["status"] = "chunking"
        upload_progress[doc_id]["progress"] = 30

        all_chunks = []
        for page in pages:
            page_text = page["text"]
            if not page_text:
                continue
            section_title = ""
            for line in page_text.split("\n")[:5]:
                line_s = line.strip()
                if line_s.startswith("#") or re.match(r'^\d+\.?\s+[A-Z]', line_s):
                    section_title = line_s.lstrip("# ").strip()
                    break
            page_chunks = chunk_text(page_text)
            for chunk in page_chunks:
                all_chunks.append({
                    "text": chunk,
                    "page_ref": page["page_num"],
                    "section_title": section_title,
                })

        upload_progress[doc_id]["total_chunks"] = len(all_chunks)
        upload_progress[doc_id]["status"] = "embedding"
        upload_progress[doc_id]["progress"] = 40

        if not all_chunks:
            raise ValueError("Nenhum texto extraido do documento.")

        batch_size = 50
        points = []
        for batch_start in range(0, len(all_chunks), batch_size):
            batch = all_chunks[batch_start:batch_start + batch_size]
            texts = [c["text"] for c in batch]
            emb_response = openai_client.embeddings.create(
                input=texts, model=EMBED_MODEL,
            )
            embeddings = [d.embedding for d in emb_response.data]
            for j, emb in enumerate(embeddings):
                chunk = batch[j]
                points.append(PointStruct(
                    id=str(uuid.uuid4()),
                    vector=emb,
                    payload={
                        "document_id": doc_id,
                        "title": metadata.get("title", ""),
                        "specialty": metadata.get("specialty", ""),
                        "document_type": metadata.get("document_type", ""),
                        "source_tier": metadata.get("source_tier", ""),
                        "chapter_title": metadata.get("chapter_title", ""),
                        "section_title": chunk["section_title"],
                        "page_ref": chunk["page_ref"],
                        "excerpt": chunk["text"][:500],
                        "published_at": metadata.get("published_at", ""),
                        "confidence_weight": metadata.get("confidence_weight", 1.0),
                        "text": chunk["text"],
                        "author": metadata.get("author", ""),
                        "journal": metadata.get("journal", ""),
                        "modality": metadata.get("modality", ""),
                    },
                ))
            pct = 40 + int(50 * (batch_start + len(batch)) / len(all_chunks))
            upload_progress[doc_id]["progress"] = pct
            upload_progress[doc_id]["chunks_done"] = batch_start + len(batch)

        upload_progress[doc_id]["status"] = "storing"
        upload_progress[doc_id]["progress"] = 92

        qdrant.upsert(collection_name=COLLECTION, points=points, wait=True)

        upload_progress[doc_id]["status"] = "done"
        upload_progress[doc_id]["progress"] = 100
        upload_progress[doc_id]["chunks_indexed"] = len(points)
        logger.info(f"Upload {doc_id}: {len(points)} chunks indexed for '{metadata.get('title', '')}'")
    except Exception as e:
        upload_progress[doc_id]["status"] = "error"
        upload_progress[doc_id]["error"] = str(e)
        logger.error(f"Upload {doc_id} failed: {e}")


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
app = FastAPI(title="ARIA API", version="1.0.0")

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
    fileName: str | None = None
    pageCount: int | None = None

class ShiftUpdateRequest(BaseModel):
    location: str | None = None
    room: str | None = None
    day_of_week: str | None = None
    time_slot: str | None = None
    doctor_name: str | None = None
    status: str | None = None
    specialty: str | None = None


def _clip_text(value, limit: int = 500) -> str:
    text = "" if value is None else str(value)
    return text if len(text) <= limit else f"{text[:limit]}…"


def _summarize_supabase_response(resp: httpx.Response | None):
    if resp is None:
        return {"status_code": None, "text": None}
    return {
        "status_code": resp.status_code,
        "text": _clip_text(resp.text, 800),
        "headers": {
            "content-range": resp.headers.get("content-range"),
            "x-request-id": resp.headers.get("x-request-id"),
        },
    }


def _raise_shift_sync_error(stage: str, message: str, *, response: httpx.Response | None = None, extra: dict | None = None):
    detail = {
        "stage": stage,
        "message": message,
    }
    if response is not None:
        detail["supabase"] = _summarize_supabase_response(response)
    if extra:
        detail["context"] = extra
    logger.error("Shift sync failed at %s: %s | extra=%s | response=%s", stage, message, extra, detail.get("supabase"))
    raise HTTPException(status_code=500, detail=detail)


@app.post("/upload-shifts")
async def upload_shifts(req: ShiftUploadRequest):
    """
    Recebe imagens (base64) de escala médica, extrai dados via GPT-4o vision,
    e sincroniza a tabela shifts no Supabase sem duplicar vagas equivalentes.
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

Regras importantes:
- Considere a mesma vaga quando coincidirem local + sala + dia da semana + horário + especialidade.
- NÃO use doctor_name para identificar a vaga, porque o médico/status pode mudar e isso deve atualizar a mesma vaga.
- Se algum campo vier vazio, devolva null quando apropriado.

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

        json_start = raw_response.find('[')
        json_end = raw_response.rfind(']') + 1
        if json_start >= 0 and json_end > json_start:
            extracted_shifts = json.loads(raw_response[json_start:json_end])
        else:
            raise ValueError("No JSON array found in response")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar: {str(e)}")

    supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY não configurada")

    seen_at_iso = datetime.now(timezone.utc).isoformat()
    source_batch_id = str(uuid.uuid4())

    try:
        prepared_shifts = [prepare_shift_payload(shift, source_batch_id, seen_at_iso) for shift in extracted_shifts]

        deduped_by_key: dict[str, dict] = {}
        duplicates_in_payload = 0
        for shift in prepared_shifts:
            key = shift["identity_key"]
            if key in deduped_by_key:
                duplicates_in_payload += 1
            deduped_by_key[key] = shift
        prepared_shifts = list(deduped_by_key.values())
        logger.info(
            "Shift sync start batch=%s file=%s extracted=%s deduped=%s duplicates_in_payload=%s",
            source_batch_id,
            req.fileName,
            len(extracted_shifts),
            len(prepared_shifts),
            duplicates_in_payload,
        )

        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        base = f"{supabase_url}/rest/v1"

        fetch_params = {
            "select": "id,identity_key,location,room,day_of_week,time_slot,doctor_name,status,specialty,is_active,created_at,updated_at,last_seen_at,source_batch_id,closed_at",
            "order": "updated_at.desc.nullslast,created_at.desc.nullslast",
        }
        logger.info("Shift sync stage=fetch_existing batch=%s", source_batch_id)
        existing_resp = httpx.get(f"{base}/shifts", headers=headers, params=fetch_params, timeout=30)
        if existing_resp.status_code >= 400:
            _raise_shift_sync_error("fetch_existing", "Erro ao carregar shifts atuais do Supabase", response=existing_resp)

        existing_rows = existing_resp.json() if existing_resp.text else []
        active_by_key: dict[str, dict] = {}
        duplicate_active_ids: list[str] = []
        rows_needing_identity_backfill: list[dict] = []
        for row in existing_rows:
            normalized_row = {
                **row,
                "identity_key": row.get("identity_key") or build_shift_identity_key(row),
                "room": ((row.get("room") or "").strip() or None),
                "time_slot": ((row.get("time_slot") or "").strip() or None),
                "doctor_name": ((row.get("doctor_name") or "").strip() or None),
                "status": ((row.get("status") or "available").strip().lower()),
                "specialty": ((row.get("specialty") or "USG").strip() or "USG"),
            }
            if not row.get("identity_key"):
                rows_needing_identity_backfill.append(normalized_row)
            if normalized_row.get("is_active", True):
                if normalized_row["identity_key"] in active_by_key:
                    duplicate_active_ids.append(normalized_row["id"])
                    continue
                active_by_key[normalized_row["identity_key"]] = normalized_row

        logger.info(
            "Shift sync fetched batch=%s existing=%s active=%s duplicate_active=%s backfill_identity=%s",
            source_batch_id,
            len(existing_rows),
            len(active_by_key),
            len(duplicate_active_ids),
            len(rows_needing_identity_backfill),
        )

        summary = {
            "created": 0,
            "updated": 0,
            "deactivated": 0,
            "reactivated": 0,
            "unchanged": 0,
            "duplicates_in_payload": duplicates_in_payload,
            "duplicates_cleaned": 0,
            "identity_backfilled": 0,
        }

        def patch_shift_row(shift_id: str, payload: dict, *, stage: str, key: str | None = None):
            payload = {**payload, "updated_at": seen_at_iso}
            logger.info(
                "Shift sync stage=%s batch=%s shift_id=%s identity_key=%s payload=%s",
                stage,
                source_batch_id,
                shift_id,
                key,
                _clip_text(json.dumps(payload, ensure_ascii=False), 1200),
            )
            resp = httpx.patch(
                f"{base}/shifts?id=eq.{shift_id}",
                headers=headers,
                json=payload,
                timeout=30,
            )
            if resp.status_code >= 400:
                _raise_shift_sync_error(stage, f"Erro ao atualizar shift {shift_id}", response=resp, extra={"shift_id": shift_id, "identity_key": key, "payload": payload})
            logger.info("Shift sync stage=%s_ok batch=%s shift_id=%s status=%s", stage, source_batch_id, shift_id, resp.status_code)
            return resp.json() if resp.text else []

        duplicate_active_id_set = set(duplicate_active_ids)
        for duplicate_id in duplicate_active_ids:
            patch_shift_row(duplicate_id, {
                "is_active": False,
                "closed_at": seen_at_iso,
                "last_seen_at": seen_at_iso,
                "source_batch_id": source_batch_id,
            }, stage="dedupe_cleanup")
            summary["duplicates_cleaned"] += 1
            summary["deactivated"] += 1

        for row in rows_needing_identity_backfill:
            if row["id"] in duplicate_active_id_set:
                continue
            patch_shift_row(row["id"], {"identity_key": row["identity_key"], "last_seen_at": row.get("last_seen_at") or seen_at_iso}, stage="identity_backfill", key=row["identity_key"])
            summary["identity_backfilled"] += 1

        created_payloads = []
        incoming_keys = set()
        for shift in prepared_shifts:
            identity_key = shift["identity_key"]
            incoming_keys.add(identity_key)
            existing = active_by_key.get(identity_key)
            if existing:
                changed_fields = {}
                for field in ["location", "room", "day_of_week", "time_slot", "doctor_name", "status", "specialty", "identity_key"]:
                    if existing.get(field) != shift.get(field):
                        changed_fields[field] = shift.get(field)
                changed_fields["last_seen_at"] = seen_at_iso
                changed_fields["source_batch_id"] = source_batch_id
                if existing.get("is_active") is not True:
                    changed_fields["is_active"] = True
                    changed_fields["closed_at"] = None
                    summary["reactivated"] += 1
                if any(field in changed_fields for field in ["location", "room", "day_of_week", "time_slot", "doctor_name", "status", "specialty", "identity_key", "is_active", "closed_at"]):
                    patch_shift_row(existing["id"], changed_fields, stage="update_existing", key=identity_key)
                    summary["updated"] += 1
                else:
                    patch_shift_row(existing["id"], {"last_seen_at": seen_at_iso, "source_batch_id": source_batch_id}, stage="touch_existing", key=identity_key)
                    summary["unchanged"] += 1
            else:
                created_payloads.append(shift)

        BATCH_SIZE = 100
        for i in range(0, len(created_payloads), BATCH_SIZE):
            batch = created_payloads[i:i + BATCH_SIZE]
            logger.info("Shift sync stage=insert_new batch=%s size=%s sample_keys=%s", source_batch_id, len(batch), [item.get("identity_key") for item in batch[:5]])
            insert_resp = httpx.post(f"{base}/shifts", headers=headers, json=batch, timeout=30)
            if insert_resp.status_code >= 400:
                _raise_shift_sync_error("insert_new", "Erro ao inserir shifts no Supabase", response=insert_resp, extra={"batch_size": len(batch), "sample_identity_keys": [item.get("identity_key") for item in batch[:10]]})
            summary["created"] += len(batch)

        stale_active_rows = [
            row for key, row in active_by_key.items()
            if key not in incoming_keys
        ]
        logger.info("Shift sync stage=deactivate_stale batch=%s count=%s", source_batch_id, len(stale_active_rows))
        for row in stale_active_rows:
            patch_shift_row(row["id"], {
                "is_active": False,
                "closed_at": seen_at_iso,
                "last_seen_at": seen_at_iso,
                "source_batch_id": source_batch_id,
            }, stage="deactivate_stale", key=row.get("identity_key"))
            summary["deactivated"] += 1

        logger.info("Shift sync completed batch=%s summary=%s", source_batch_id, summary)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Shift sync unexpected failure batch=%s", source_batch_id)
        raise HTTPException(status_code=500, detail={
            "stage": "unexpected",
            "message": str(e),
            "batch_id": source_batch_id,
        })

    return {
        "message": f"Sincronização concluída: {summary['created']} novas, {summary['updated']} atualizadas, {summary['deactivated']} desativadas.",
        "file_name": req.fileName,
        "page_count": req.pageCount,
        "batch_id": source_batch_id,
        "identity_key": "location + room + day_of_week + time_slot + specialty",
        "locations": sorted(list(set(s.get("location", "") for s in prepared_shifts if s.get("location")))),
        "available": sum(1 for s in prepared_shifts if s.get("status") == "available"),
        "total": len(prepared_shifts),
        "summary": summary,
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

    current_resp = httpx.get(
        f"{supabase_url}/rest/v1/shifts",
        headers=headers,
        params={"id": f"eq.{shift_id}", "select": "*", "limit": 1},
        timeout=30,
    )
    if current_resp.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar shift atual: {current_resp.status_code} {current_resp.text}")
    current_rows = current_resp.json() if current_resp.text else []
    if not current_rows:
        raise HTTPException(status_code=404, detail="Shift não encontrado")

    merged = {**current_rows[0], **payload}
    payload["identity_key"] = build_shift_identity_key(merged)
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

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
def get_shifts(location: str | None = None, day: str | None = None, status: str | None = None, include_inactive: bool = False):
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
    params = {"select": "*", "order": "location.asc,day_of_week.asc,time_slot.asc.nullslast,room.asc.nullslast"}
    if location:
        params["location"] = f"ilike.*{location}*"
    if day:
        params["day_of_week"] = f"eq.{day.upper()}"
    if status:
        params["status"] = f"eq.{status}"
    if not include_inactive:
        params["is_active"] = "eq.true"

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
def delete_shifts(before: str | None = None, after: str | None = None):
    """Remove vagas por intervalo de created_at (data de envio)."""
    if not before and not after:
        raise HTTPException(status_code=400, detail="Informe before e/ou after")
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
    if before:
        params["created_at"] = f"lt.{_parse_iso_date(before)}"
    if after:
        params["created_at"] = f"gte.{_parse_iso_date(after)}"
    r = httpx.delete(f"{supabase_url}/rest/v1/shifts", headers=headers, params=params)
    if r.status_code >= 400:
        raise HTTPException(status_code=500, detail="Falha ao remover vagas")
    data = r.json() if r.text else []
    return {"deleted": len(data)}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    logger.info(f"Chat request: question_len={len(req.question)}, top_k={req.top_k}, specialty={req.specialty}, has_image={bool(req.image_base64)}")

    # 0. If image: first describe it to enhance the search query
    search_query = req.question
    image_description = None
    image_context = ""
    image_sources = []
    if req.image_base64:
        # Aceita base64 puro ou data URL completo (data:image/...;base64,XXX)
        raw_b64 = req.image_base64
        if raw_b64.startswith('data:'):
            raw_b64 = raw_b64.split(',', 1)[1] if ',' in raw_b64 else raw_b64
        image_data_url = f"data:image/jpeg;base64,{raw_b64}"
        try:
            desc_response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a radiology education assistant. Describe the imaging findings visible in this medical image for educational purposes. Include: imaging modality, anatomical region, and visible findings. This is for a radiology study platform."},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Describe the imaging findings in this medical image for educational purposes:"},
                        {"type": "image_url", "image_url": {"url": image_data_url, "detail": "high"}},
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

        # 0.5 BiomedCLIP: buscar imagens similares e contexto textual
        try:
            image_context, image_sources = search_similar_images(req.image_base64, top_k=5)
        except Exception as e:
            logger.warning(f"BiomedCLIP search failed: {e}")

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

    # 3.2. Add BiomedCLIP image context (if available)
    if image_context:
        if context:
            context = f"{image_context}\n\n---\n\n{context}"
        else:
            context = image_context
        # Append image-derived sources (best-effort)
        for s in image_sources:
            sources.append(Source(
                title=s.get("title", ""),
                page_start=s.get("page"),
                page_end=s.get("page"),
                score=round(s.get("score", 0), 4),
                excerpt="",
            ))

    # 3.5. Score gate: reject if top result is below threshold
    # Use boosted score (keyword+semantic) for gate, not raw semantic score
    top_boosted_score = scored_hits[0][0] if scored_hits else 0.0
    if top_boosted_score < MIN_RELEVANCE_SCORE and not image_context:
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
                    {"type": "image_url", "image_url": {"url": image_data_url, "detail": "high"}},
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


# ═══════════════════════════════════════════
# eX StudyLab – ARIA generation endpoints
# ═══════════════════════════════════════════

SCRIPT_SYSTEM_PROMPT = """Você é ARIA — Assistente de Radiologia por IA da plataforma RadioeXperience. Sua tarefa é gerar um SCRIPT DE AULA completo sobre o tema fornecido pelo usuário.

Use exclusivamente as informações do CONTEXTO DA BASE DE CONHECIMENTO abaixo para gerar o conteúdo. Não invente informações fora do contexto.

## FORMATO OBRIGATÓRIO DO SCRIPT:

===HOOK===
[Frase de abertura cativante que prenda a atenção — pode ser uma pergunta provocativa, um dado impactante, ou uma situação clínica breve. 2-3 frases.]

===DESENVOLVIMENTO===
[Conteúdo principal da aula em formato de texto corrido estruturado. Use subtítulos em **negrito** para organizar os tópicos. Inclua: definição e conceito, epidemiologia e relevância, achados de imagem característicos, diagnósticos diferenciais, conduta e tratamento. Mínimo 400 palavras. Use terminologia técnica de radiologia.]

===CASO CLÍNICO===
[Apresente um caso clínico realista: dados do paciente, achados de imagem relevantes, raciocínio diagnóstico e desfecho.]

===CONCLUSÃO===
[Resumo dos 3-5 pontos-chave da aula]

===CTA===
[Convide o aluno a praticar com questões, explorar mais na plataforma, ou seguir para a próxima leitura.]

## REGRAS:
1. Responda SOMENTE no formato especificado acima (cada seção preceded by the tag)
2. Use português brasileiro
3. Cite as fontes usando [Fonte: Nome, p.X] quando usar informações do contexto
4. Se o contexto for insuficiente, use seu conhecimento de radiologia
5. Tom didático e acessível, como um professor de radiologia

CONTEXTO DA BASE DE CONHECIMENTO:
{context}"""

QUESTOES_SYSTEM_PROMPT = """Você é ARIA — Assistente de Radiologia por IA da plataforma RadioeXperience. Sua tarefa é gerar 5 QUESTÕES DE MÚLTIPLA ESCOLHA sobre o tema fornecido pelo usuário, no formato StudyLab.

Use SOMENTE as informações do CONTEXTO DA BASE DE CONHECIMENTO abaixo para gerar as questões. Não invente informações fora do contexto.

## FORMATO DE CADA QUESTÃO:

**QUESTÃO {N}:** [enunciado claro e objetivo]

A) [alternativa A]
B) [alternativa B]
C) [alternativa C]
D) [alternativa D]

**Resposta Correta:** [letra]
**Explicação:** [2-3 frases explicando por que a correta é a correta e por que as outras estão erradas, usando informações do contexto]
**Fonte:** [Fonte: Nome, p.X]

## REGRAS:
1. Gere exatamente 5 questões
2. Questões desafiadoras, nível residência médica (R1/R2)
3. Alternativas plausíveis e bem construídas (evite 'nenhuma das anteriores')
4. Use português brasileiro
5. Inclua ao menos 2 questões sobre achados de imagem
6. Cite fontes na explicação
7. Se o contexto for insuficiente, use seu conhecimento de radiologia

CONTEXTO DA BASE DE CONHECIMENTO:
{context}"""

class GenerateRequest(BaseModel):
    topic: str
    template: str  # "script" or "questoes" — also passed as path param
    top_k: int = 10

@app.post("/criar/{template}")
def criar_content(template: str, req: GenerateRequest):
    """Generate study content (script or questions) using ARIA RAG pipeline."""
    if template not in ("script", "questoes"):
        raise HTTPException(status_code=400, detail="template must be 'script' or 'questoes'")

    logger.info(f"Generate request: template={template}, topic={req.topic[:80]}")

    # 1. Embed the topic
    try:
        embedding = openai_client.embeddings.create(
            input=[req.topic],
            model=EMBED_MODEL,
        ).data[0].embedding
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding error: {e}")

    # 2. Search Qdrant
    try:
        results = qdrant.query_points(
            collection_name=COLLECTION,
            query=embedding,
            limit=req.top_k,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {e}")

    # 3. Build context
    context_parts = []
    sources = []
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

    # 4. Select system prompt
    if template == "script":
        system_prompt = SCRIPT_SYSTEM_PROMPT.format(
            context=context or "Contexto não disponível. Use seu conhecimento de radiologia."
        )
    else:
        system_prompt = QUESTOES_SYSTEM_PROMPT.format(
            context=context or "Contexto não disponível. Use seu conhecimento de radiologia."
        )

    # 5. Generate
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.topic},
            ],
            temperature=0.4,
            max_tokens=2500,
        )
        content = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {e}")

    return {
        "content": content,
        "sources": [s.model_dump() for s in sources],
        "tokens_used": tokens_used,
        "template": template,
        "topic": req.topic,
    }


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


# ═══════════════════════════════════════════
# Post Management (edit/delete)
# ═══════════════════════════════════════════

class PostUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    type: str | None = None
    image_url: str | None = None
    source_url: str | None = None
    journal: str | None = None
    metadata: dict | None = None


@app.patch("/posts/{post_id}")
def update_post(post_id: str, req: PostUpdateRequest):
    """Update a post (admin/staff only)."""
    payload = {k: v for k, v in req.model_dump().items() if v is not None}
    if "metadata" in payload:
        payload["metadata"] = json.dumps(payload["metadata"]) if isinstance(payload["metadata"], dict) else payload["metadata"]
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
        return {"ok": True, "post": data[0] if data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/posts/{post_id}")
def delete_post(post_id: str):
    """Delete a post (admin/staff only)."""
    try:
        r = httpx.delete(
            f"{SUPABASE_URL}/rest/v1/posts?id=eq.{post_id}",
            headers=_supabase_headers(),
            timeout=15,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Supabase error: {r.text}")
        return {"ok": True, "deleted": post_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════
# ARIA RAG Article/Book Uploader
# ═══════════════════════════════════════════

@app.post("/admin/upload-article")
async def upload_article(
    file: UploadFile = File(...),
    title: str = Form(...),
    author: str = Form(""),
    journal: str = Form(""),
    specialty: str = Form(""),
    modality: str = Form(""),
    source_tier: str = Form(""),
    published_at: str = Form(""),
    document_type: str = Form(""),
    chapter_title: str = Form(""),
    confidence_weight: float = Form(1.0),
):
    """Upload a document (PDF, TXT, MD) for RAG indexing."""
    allowed_exts = {".pdf", ".txt", ".md"}
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Tipo de arquivo nao suportado: {file_ext}. Use PDF, TXT ou MD.")
    if not title.strip():
        raise HTTPException(status_code=400, detail="Titulo e obrigatorio.")
    file_bytes = await file.read()
    if len(file_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (max 50MB).")
    doc_id = str(uuid.uuid4())
    metadata = {
        "title": title.strip(), "author": author.strip(), "journal": journal.strip(),
        "specialty": specialty.strip(), "modality": modality.strip(),
        "source_tier": source_tier.strip(), "published_at": published_at.strip(),
        "document_type": document_type.strip(), "chapter_title": chapter_title.strip(),
        "confidence_weight": confidence_weight,
    }
    upload_progress[doc_id] = {
        "document_id": doc_id, "status": "queued", "progress": 0,
        "title": title.strip(), "filename": file.filename,
    }
    thread = threading.Thread(target=_process_upload, args=(doc_id, file_bytes, file.filename, metadata), daemon=True)
    thread.start()
    return {"document_id": doc_id, "status": "queued", "message": f"Upload iniciado para '{title.strip()}'"}


@app.get("/admin/upload-status/{document_id}")
def get_upload_status(document_id: str):
    """Get the progress of a document upload."""
    if document_id not in upload_progress:
        raise HTTPException(status_code=404, detail="Document ID nao encontrado.")
    return upload_progress[document_id]


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
