# RadioeXperience — Memória do Projeto

## O que é
Plataforma de ensino de radiologia com assistente IA (ARIA), base de conhecimento RAG, e sistema de escalas/vagas.

## Stack
- **Frontend**: React + Vite + Tailwind (web/src), hospedado na Vercel
- **Backend**: FastAPI (Python), hospedado no Railway
- **Banco de dados**: Supabase (PostgreSQL + Auth + Storage)
- **Vector DB**: Qdrant Cloud (AWS sa-east-1)
- **IA**: OpenAI (gpt-4o, gpt-4o-mini, text-embedding-3-small)
- **Embedding visual**: BiomedCLIP (HuggingFace Inference API)
- **Domínios**: radioexperience.com.br, www.radioexperience.com.br, victorvignal.github.io

## Repositório
`https://github.com/victorvignal/radioexperience`
Branch principal: `main`

## Endpoints importantes
- **Backend chat**: `https://aria-backend-production-176b.up.railway.app/chat`
- **Backend health**: `https://aria-backend-production-176b.up.railway.app/health`
- **Frontend**: `https://radioexperience.com.br`
- **Supabase**: `https://pcdequsipbkxcfsewiow.supabase.co`

## Infraestrutura

### Qdrant Collections
- `radioexperience_knowledge` — chunks textuais de livros/artigos de radiologia
- `radioexperience_images` — embeddings de imagens médicas (BiomedCLIP)

### Tabelas Supabase
- `shifts` — vagas de escala médica (location, room, day_of_week, time_slot, doctor_name, status, specialty, batch_id)
- `aria_chats` — sessões de chat por usuário (id, user_id, title, messages, created_at, updated_at)

## ARIA (Assistente IA)
- System prompt definido em `backend/main.py` → variável `SYSTEM_PROMPT`
- Arquitetura: RAG (Qdrant → embedding → reranking → contexto → GPT-4o)
- Busca híbrida: vetorial + keyword boost + bigrams
- Suporta imagem: GPT-4o vision + BiomedCLIP similarity search
- Score gate mínimo: 0.55 (rejeita perguntas sem contexto relevante)
- max_tokens resposta: 1500

## Comandos úteis

### Git
```bash
cd radioexperience
git add .
git commit -m "mensagem"
git push
```

### Backend (local)
```bash
cd radioexperience/backend
pip install -r requirements.txt
python main.py
# ou com uvicorn direto:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (local)
```bash
cd radioexperience/web
npm install
npm run dev
```

### Health check
```bash
curl https://aria-backend-production-176b.up.railway.app/health
```

## Bugs conhecidos / pendências
- Bug AriaPage: `L.from(...).eq is not a function` no console quando carrega chats (provavelmente Supabase query)
- SPA routing: precisa de vercel.json com rewrites se frontend no Vercel
- Shifts: upload de escala médica via GPT-4o vision → Supabase

## Otimizações ARIA (2026-04-19)
### Backend
- **Streaming SSE**: novo endpoint `POST /chat/stream` — tokens chegam em tempo real
- **Fallback não-streaming**: `POST /chat` reescrito como async
- **Lifespan**: startup health checks (OpenAI, Qdrant) + graceful shutdown com cleanup do HTTP client
- **Async HTTP client**: `httpx.AsyncClient` compartilhado com connection pooling
- **Pydantic v2**: `ChatRequest` e `ChatResponse` migrados para `ConfigDict`, `Field`, `field_validator`
- **Auth async**: `verify_supabase_token` agora é `async`

### Frontend (AriaChat.jsx)
- **Streaming**: tokens aparecen em tempo real enquanto ARIA digita
- **AbortController**: se usuário mandar nova msg enquanto digita, cancela a anterior
- **Scroll automático**: acompanha streaming text
- **Fallback URL**: tenta `/chat/stream` → `/stream` → `/chat`

### Como testar streaming
```bash
curl -X POST https://aria-backend-production-176b.up.railway.app/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "O que é BI-RADS?"}'
```

## Como fazer deploy

### Backend (Railway)
1. Push no GitHub → Railway detecta automaticamente (Dockerfile presente)
2. Variáveis de ambiente no Railway dashboard:
   - OPENAI_API_KEY
   - QDRANT_URL
   - QDRANT_API_KEY
   - QDRANT_COLLECTION=radioexperience_knowledge
   - OPENAI_EMBED_MODEL=text-embedding-3-small
3. Railway rebuilda automaticamente no push pra main

### Frontend (Vercel)
```bash
cd radioexperience/web
vercel --prod
```
Ou conectar o repo no dashboard da Vercel com deploy automático em push.

## Configuração de API (janela/URL)
- O frontend lê `?api=https://...` da URL ou `window.ARIA_API_URL` ou `import.meta.env.VITE_ARIA_API`
- Default: `https://aria-backend-production-176b.up.railway.app/chat`

## Padrões de código
- Backend: FastAPI + Pydantic + httpx (cliente HTTP)
- Frontend: React + hooks + sessionStorage pra cache de sessões
- Autenticação: Supabase Auth com AuthContext
- RAG: embedding com OpenAI → Qdrant → reranking → contexto → GPT-4o

## Variáveis de ambiente (.env do backend — NUNCA commitar)
```
OPENAI_API_KEY=sk-...
QDRANT_URL=https://...sa-east-1-0.aws.cloud.qdrant.io
QDRANT_API_KEY=eyJ...
QDRANT_COLLECTION=radioexperience_knowledge
OPENAI_EMBED_MODEL=text-embedding-3-small
RAG_BASE_PATH=C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG
```

## Integrações
- **OpenAI**: embeddings + GPT-4o + GPT-4o-mini + image generation (gpt-image-1.5)
- **Qdrant**: vector search
- **BiomedCLIP** (HF Inference API): embedding de imagens médicas
- **Supabase**: banco relacional + auth + storage
- **WhatsApp Gateway**: OpenClaw ( integrado em strelizia2026)

## Mensagens de commit (convenções)
- `feat:` — nova funcionalidade
- `fix:` — correção de bug
- `docs:` — documentação
- `refactor:` — refatoração
- `chore:` — config, deps, build
- `perf:` — melhoria de performance

Exemplo: `feat(aria): novo system prompt - modo preceptoria e raciocínio guiado`
