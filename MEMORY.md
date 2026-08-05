# RadioeXperience — Memória do projeto (atualizado)

> Regenerado em 2026-08-04 a partir do código real do repo `victorvignal/radioexperience`.
> Versão anterior estava desatualizada — esta reflete o `main` atual.

## O que é

Plataforma de educação em radiologia com assistente IA (ARIA), RAG multimodal (texto + imagem), sistema de quiz (Challenge), criação de conteúdo (eX StudyLab), escalas médicas (Shifts), feed social, e programa de embaixadores.

## Stack real

| Camada | Tecnologia |
|---|---|
| Frontend principal | React 19 + Vite 8 + Tailwind v4 + react-router-dom 7 (`web/src/`) |
| Frontend legado | HTML/CSS/JS vanilla standalone (`frontend/index.html`, 356 linhas) |
| Backend | FastAPI 0.115.6 + Pydantic v2 + httpx + slowapi + tenacity |
| Auth | Supabase Auth (`@supabase/supabase-js` 2.101) + JWT decoded no backend |
| Banco | Supabase Postgres (`pcdequsipbkxcfsewiow.supabase.co`) com RLS |
| Vetor | Qdrant Cloud (AWS sa-east-1) — `radioexperience_knowledge` + `radioexperience_images` |
| LLM | OpenAI: `gpt-5.4-mini` (texto), `gpt-5.4` (visão), `text-embedding-3-small`, `gpt-image-1.5` |
| Visual embed | BiomedCLIP via HF Inference API |
| Deploy backend | Railway (`Dockerfile` standalone, Python 3.12-slim, user não-root) |
| Deploy frontend | Vercel com SPA rewrites (`vercel.json`) |

## Repositório

- URL: `https://github.com/victorvignal/radioexperience`
- Branch: `main` (único)
- 194 commits, autor Victor (`vignal27@gmail.com`)

## Tamanho do código

| Arquivo | Linhas |
|---|---|
| `backend/main.py` | 3020 |
| `web/src/pages/Dashboard.jsx` | 2083 |
| `web/src/pages/Create.jsx` | 1767 |
| `web/src/pages/AriaPage.jsx` | 1269 |
| `web/src/pages/ChallengePage.jsx` | 971 |
| `web/src/pages/AdminUsers.jsx` | 738 |
| `web/src/pages/Feed.jsx` | 763 |
| `web/src/pages/Teams.jsx` | 718 |
| `web/src/pages/MyProjects.jsx` | 570 |
| `web/src/pages/ProfileSetup.jsx` | 496 |
| `web/src/pages/Signup.jsx` | 467 |
| `web/src/pages/Login.jsx` | 453 |
| `web/src/pages/PostView.jsx` | 437 |
| `web/src/pages/NewPost.jsx` | 361 |
| `web/src/pages/AdminUpload.jsx` | 334 |
| `web/src/pages/UserProfile.jsx` | 344 |
| `web/src/pages/Vagas.jsx` | 261 |
| `web/src/pages/ArticleUpload.jsx` | 264 |
| `web/src/pages/AuthCallback.jsx` | 69 |
| `web/src/App.jsx` | 620 |
| `web/src/contexts/AuthContext.jsx` | 180 |
| `web/src/pages/aria/ChatPanel.jsx` | 351 |
| `web/src/pages/aria/Sidebar.jsx` | 233 |
| `frontend/index.html` (legado) | 356 |

Total frontend: ~14.834 linhas. Backend: 3020 linhas. Scripts: ~9.788 linhas (54 arquivos).

## Endpoints do backend (31 total)

### Saúde / info
- `GET /health` — verifica Qdrant + OpenAI + Supabase
- `GET /specialties` — lista especialidades com count estimado

### Chat RAG
- `POST /chat` (não-streaming async, fallback)
- `POST /chat/stream` (SSE, asyncio.to_thread pro OpenAI sync)
- `POST /chat/edit` (edição de conteúdo com fact-check)
- `GET /chat-sessions`, `POST /chat-sessions`, `PATCH /chat-sessions/{id}`, `DELETE /chat-sessions/{id}`
- `GET /chat-sessions/{id}/messages`, `POST /chat-messages`

### Criação de conteúdo (eX StudyLab)
- `POST /criar/{template_type}` — 6 templates: `script`, `slides`, `mapa_mental`, `tabela`, `questoes`, `caso_clinico`
- Cada template tem `system_prompt`, `credits` (30-100), e label próprio
- `slides` gera imagem via `gpt-image-1.5`

### ARIA Challenge (quiz)
- `POST /challenge/start` — pega do pool CBR, gera via LLM se faltar
- `POST /challenge/answer` — calcula pontos (base 100 + speed bonus até 50)
- `POST /challenge/finish` — finaliza e retorna details
- `GET /challenge/leaderboard` — ranking weekly/monthly/all
- `GET /challenge/history` — histórico do usuário
- `GET /challenge/debug-insert` — endpoint de debug

### Feed / Posts
- `POST /feed/articles`, `POST /feed/vagas`, `POST /feed/social`
- `GET /feed/posts` (filtro type, ordem created_at desc)
- `PATCH /posts/{id}`, `DELETE /posts/{id}`

### Escalas médicas (Shifts)
- `POST /upload-shifts` — upload de imagem → `gpt-5.4-mini` vision → JSON → Supabase
- `GET /shifts`, `PATCH /shifts/{id}`, `DELETE /shifts/{id}`, `DELETE /shifts/bulk`
- `GET /shifts/batches` — lista de lotes

## Fluxo RAG (comum em `/chat` e `/chat/stream`)

1. Bypass trivial: greeting/identity → resposta sem RAG
2. Se `image_base64`:
   - `gpt-5.4-mini` descreve achados
   - BiomedCLIP gera embedding → top-5 imagens similares no Qdrant
3. Embedding da query (com retry exponencial)
4. Search Qdrant com filtro opcional de especialidade, `limit = max(top_k, 50)`
5. Hybrid re-ranking: keyword boost (0.02/termo, 0.05/bigrama) + 2ª busca focada em key_terms
6. Score gate: se `top_score < 0.55` E sem imagem, rejeita
7. Context: 800 chars por chunk, com `[Fonte N: title, p.X-Y]`
8. LLM: `gpt-5.4` com imagem, `gpt-5.4-mini` sem imagem
9. Citation footer: se resposta não menciona "Fonte:" e tem sources, anexa refs

## Specialty normalization

19 entradas. "tórax" → "torax", "músculo esquelético" → "msk", "neuroimagem" → "neurorradiologia", "cabeça e pescoço" → "cabeca/pescoco", etc. Default "geral".

## Tabelas Supabase

### Schema canônico RAG (`sql/rag_schema.sql`)
9 tabelas: `sources`, `article_candidates`, `documents`, `document_sections`, `document_contents`, `document_chunks`, `ingestion_runs`, `review_queue`, `book_inventory`

### Multimodal (`sql/multimodal_schema.sql`)
2 tabelas: `document_images`, `image_links`

### Migrations
- `2026-04-09_curated_articles.sql` — fila editorial (1 artigo/dia)
- `2026-04-09_shifts_sync.sql` — sync de escalas
- `2026-04-26_challenge_images.sql` — colunas image_url/image_base64 no challenge pool + questions

### Tabelas operacionais
- `profiles` (id, email, full_name, role, avatar_url, specialty, profile_complete)
- `aria_chats` ou `aria_chat_sessions` + `aria_chat_messages` — histórico de chat
- `shifts` — vagas de escala médica (location, room, day_of_week, time_slot, doctor_name, status, specialty, batch_id, source_file)
- `posts` — feed social (type: article | vaga | post, content, metadata, image_url)
- `challenges` + `challenge_questions` + `challenge_responses` + `challenge_question_pool` — quiz

## Roles

- `admin`: `radioexperience.project@gmail.com`, `vignal27@gmail.com`
- `staff`: `vignal27@gmail.com`
- demais: `user`

`AuthContext` auto-cria profile pra admin/staff no primeiro login.

## Dados atuais

| Item | Quantidade |
|---|---|
| Questões CBR (RDDI + USG) | 327 |
| Imagens CBR embutidas | 157 |
| Especialidades RAG | 9 (geral, neurorradiologia, pediatria, intervenção, abdome, msk, mama, radioprotecao, tórax) |
| Planos de pricing | 4 (Free, Pro R$297, Squad R$227, Command custom) |
| Pilares da plataforma | 7 (ARIA, Challenge, StudyLab, Academy, Teams, Calculator, Analytics) |
| Scripts Python/Node | 54 |

## Endpoints importantes

| Serviço | URL |
|---|---|
| Backend chat | `https://aria-backend-production-176b.up.railway.app/chat` |
| Backend streaming | `https://aria-backend-production-176b.up.railway.app/chat/stream` |
| Backend health | `https://aria-backend-production-176b.up.railway.app/health` |
| Frontend (gh pages) | `https://victorvignal.github.io` |
| Frontend (custom) | `https://radioexperience.com.br` |
| Supabase | `https://pcdequsipbkxcfsewiow.supabase.co` |

## Variáveis de ambiente

```
OPENAI_API_KEY=sk-...
QDRANT_URL=https://...sa-east-1-0.aws.cloud.qdrant.io
QDRANT_API_KEY=eyJ...
QDRANT_COLLECTION=radioexperience_knowledge
OPENAI_EMBED_MODEL=text-embedding-3-small
MIN_RELEVANCE_SCORE=0.55
SUPABASE_URL=https://pcdequsipbkxcfsewiow.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
PORT=8000
```

Frontend (Vite env): `VITE_ARIA_API=https://aria-backend-production-176b.up.railway.app/chat`
Override runtime: `?api=...` na URL ou `window.ARIA_API_URL`.

## Padrões de código

- Backend: FastAPI + Pydantic v2 + httpx (cliente HTTP async compartilhado via `get_http_client()`)
- Frontend: React 19 hooks + AuthContext global + sessionStorage pra cache de sessões ARIA
- CSS: inline styles + variáveis CSS no `:root`, sem Tailwind classes (Tailwind v4 instalado mas pouco usado)
- Autenticação: Supabase Auth com `verify_supabase_token` no backend
- RAG: OpenAI embedding → Qdrant → keyword boost → GPT-5.4
- Streaming: SSE via `StreamingResponse` + `asyncio.to_thread` pro OpenAI sync
- Cancelamento: `AbortController` no frontend cancela request anterior

## Pendências e bugs conhecidos

### Bugs
- `L.from(...).eq is not a function` no AriaPage ao carregar chats (do MEMORY anterior, status incerto)
- `EditPanel` foi reabilitado depois de desabilitado por overlay blocking (resolvido `0cbe1ba`)
- `gpt-5.4-mini` precisa `max_completion_tokens` (não `max_tokens`) — resolvido `cba6e16`

### Debts técnicos
- `main.py` monolítico (3020 linhas, 31 endpoints) — falta modularizar em routers
- System prompts inline (não em `prompts/`)
- Imports locais duplicados (`import httpx`, `import uuid`, `import json` dentro de funções)
- Sync OpenAI client em rotas async (mitigado parcialmente com `asyncio.to_thread`)
- CORS hardcoded (lista de origens manual)
- JWT decode sem verificação de assinatura (validação via `profiles` table)
- Backend sem `tests/`
- Frontend vanilla legado (`frontend/index.html`) coexiste com React — possível candidato a remoção

### Features declaradas mas não implementadas
- **eX Calculator** — pilares do landing, sem código de implementação encontrado
- **eX Academy** — microlessons com avatar HeyGen, só declarado
- **eX Analytics** — dashboard coordenador, sem código encontrado
- **C3 (não-random)** do CBR — só 25 calls no protótipo, não expandido pro estudo completo

## Glossário

- **ARIA** — assistente de radiologia (chat principal)
- **eX StudyLab** — gerador de conteúdo educacional (6 templates)
- **eX Academy** — microlessons (declarado, não implementado)
- **eX Teams** — gestão de equipes/escalas
- **eX Calculator** — calculadoras radiológicas (declarado, não implementado)
- **eX Challenge** — quiz humano vs IA
- **eX Analytics** — dashboard (declarado, não implementado)
- **CBR** — Concurso Brasileiro de Radiologia
- **RDDI** — Residência em Diagnóstico por Imagem
- **USG** — Ultrassonografia
- **Embaixador** — programa de afiliados com revenue share
- **C1, C2, C3, C3R** — condições do prompt no Challenge (genérica, label diagnóstico, perfil rico, perfil rico random)
