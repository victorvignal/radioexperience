# RadioeXperience — Análise completa do repositório

> Análise feita lendo o código atual do `main` em `https://github.com/victorvignal/radioexperience`.
> Última leitura: 2026-08-04.

## Visão geral

RadioeXperience é uma plataforma de **educação em radiologia com IA**, composta por:

- **Backend FastAPI** (`backend/main.py`, 3020 linhas) com RAG multimodal (texto + imagem), agente de quiz (Challenge), criação de conteúdo educacional (eX StudyLab), sistema de escalas médicas (shifts), feed social, gestão de sessões de chat, e upload de artigos via vision.
- **Frontend React + Vite + Tailwind v4** (`web/src/`, ~14.834 linhas em 18+ páginas) com landing page, ARIA chat, Challenge, eX StudyLab (Create), Dashboard, Feed, Times, Admin, Login/Signup.
- **Frontend vanilla legado** (`frontend/index.html`, 356 linhas) — versão anterior do chat standalone, ainda no repo.
- **Supabase** (`pcdequsipbkxcfsewiow.supabase.co`) com Auth + Postgres + Storage.
- **Qdrant Cloud** (AWS sa-east-1) com coleções `radioexperience_knowledge` (texto) e `radioexperience_images` (BiomedCLIP embeddings).

## Stack real

| Camada | Tecnologia | Evidência |
|---|---|---|
| Backend | FastAPI 0.115.6 + Pydantic v2 + httpx 0.28 + slowapi (rate limit) + tenacity (retry) | `backend/requirements.txt` |
| Frontend | React 19.2 + Vite 8 + Tailwind 4 + react-router-dom 7 + marked + markmap + pdfjs-dist | `web/package.json` |
| Auth | Supabase Auth via `@supabase/supabase-js` 2.101 (frontend) + JWT decoded no backend | `web/src/contexts/AuthContext.jsx`, `backend/main.py:255` |
| Vetor | Qdrant Cloud (`qdrant-client==1.12.1`) + OpenAI `text-embedding-3-small` | `backend/main.py:101` |
| LLM | OpenAI: `gpt-5.4-mini` (texto), `gpt-5.4` (visão), `gpt-image-1.5` (geração de imagens) | commits `e2f946a`, `cba6e16`, `backend/main.py:1025/1205/2753` |
| DB | Supabase Postgres + RLS | `sql/*.sql` |
| Storage | Supabase Storage (posts imagens) | `web/src/lib/postImages.js` |
| Deploy backend | Railway (Dockerfile) | `Dockerfile`, `railway.json` |
| Deploy frontend | Vercel com rewrites SPA | `vercel.json` |
| Modelos visuais extras | BiomedCLIP (HF Inference API) para similaridade de imagens | `backend/main.py:142` |

## Mapa do frontend React (`web/src/`)

| Página | Linhas | Função |
|---|---|---|
| `App.jsx` | 620 | Landing page + roteamento, navbar, hero, 7 pillars, pricing, embaixadores |
| `pages/AriaPage.jsx` | 1269 | Chat ARIA principal com sidebar de sessões, streaming, markdown |
| `pages/Create.jsx` | 1767 | eX StudyLab: criar script/slides/mapa_mental/tabela/questoes/caso_clinico |
| `pages/Dashboard.jsx` | 2083 | Painel principal do usuário logado |
| `pages/ChallengePage.jsx` | 971 | Quiz "Humano vs IA" (CBR/RDDI/USG), com pool de questões |
| `pages/Feed.jsx` | 763 | Feed público social (artigos, vagas, posts) |
| `pages/AdminUpload.jsx` | 334 | Upload de artigos (admin) |
| `pages/AdminUsers.jsx` | 738 | Painel admin de usuários |
| `pages/Teams.jsx` | 718 | Gestão de equipes/escalas |
| `pages/MyProjects.jsx` | 570 | Projetos salvos do StudyLab |
| `pages/Vagas.jsx` | 261 | Lista de vagas/escalas |
| `pages/NewPost.jsx` | 361 | Criar post no feed |
| `pages/PostView.jsx` | 437 | Ver post individual |
| `pages/ProfileSetup.jsx` | 496 | Setup inicial de perfil |
| `pages/UserProfile.jsx` | 344 | Perfil público do usuário |
| `pages/Login.jsx` | 453 | Tela de login |
| `pages/Signup.jsx` | 467 | Tela de cadastro |
| `pages/ArticleUpload.jsx` | 264 | Upload de artigos (outro fluxo) |
| `pages/AuthCallback.jsx` | 69 | Callback OAuth Supabase |

Módulos auxiliares:
- `contexts/AuthContext.jsx` (180 linhas) — auth global com roles (admin, staff, user), perfis e auto-criação para staff
- `lib/supabase.js` (15 linhas) — cliente Supabase
- `lib/postImages.js` (54 linhas) — upload de imagens de posts pro Storage
- `lib/comments.js` (70 linhas) — sistema de comentários
- `lib/avatar.js` (10 linhas) — avatares
- `components/ProtectedRoute.jsx` — guarda de rotas autenticadas
- `pages/aria/` — sub-módulos do AriaPage (ChatPanel 351, Sidebar 233, constants, Icons, mardown, sessionCache, Style)

## Mapa do backend (`backend/main.py`, 3020 linhas, 31 endpoints)

### Saúde e info
- `GET /health` — verifica Qdrant (count), OpenAI, Supabase
- `GET /specialties` — lista especialidades com contagem estimada

### Chat RAG
- `POST /chat` (não-streaming, 1063) — fallback async com mirror da lógica do stream
- `POST /chat/stream` (867) — SSE streaming, `asyncio.to_thread` pro sync OpenAI client
- `POST /chat/edit` (1301) — edição de conteúdo com RAG factual check
- `GET/POST/PATCH/DELETE /chat-sessions` (2778–2912) — CRUD sessões por usuário
- `GET/POST /chat-messages` (2927–3014) — mensagens por sessão

### Criação de conteúdo (eX StudyLab)
- `POST /criar/{template_type}` (2665) — 6 templates: script, slides, mapa_mental, tabela, questoes, caso_clinico
- Cada template tem system prompt próprio, credits, e gera imagem (slides)

### ARIA Challenge (quiz)
- `POST /challenge/start` (2002) — pega do pool CBR, gera via LLM se faltar
- `POST /challenge/answer` (2118) — calcula pontos (base 100 + speed bonus até 50)
- `POST /challenge/finish` (2217) — finaliza e retorna details
- `GET /challenge/leaderboard` (2291) — ranking weekly/monthly/all
- `GET /challenge/history` (2373) — histórico do usuário
- `GET /challenge/debug-insert` (1936) — endpoint de debug pra diagnosticar insert

### Feed / Posts
- `POST /feed/articles` (1451), `POST /feed/vagas` (1489), `POST /feed/social` (1530)
- `GET /feed/posts` (1557) — lista com filtro type
- `PATCH /posts/{id}` (1575), `DELETE /posts/{id}` (1597)

### Escalas médicas (Shifts)
- `POST /upload-shifts` (554) — upload de imagem → GPT-4o vision → Supabase
- `GET/PATCH/DELETE /shifts` — CRUD
- `DELETE /shifts/bulk` (747), `DELETE /shifts/{id}` (778)
- `GET /shifts/batches` (830) — lista de lotes de upload

### Autenticação
- `verify_supabase_token` (255) — decodifica JWT, valida via tabela `profiles`

### RAG pipeline (lógica comum nos 2 chats)

1. **Bypass trivial**: greeting/identity check, responde direto sem RAG
2. **Image preprocessing** (se image_base64):
   - GPT-4o-mini descreve achados da imagem
   - BiomedCLIP gera embedding, busca top-5 similares no Qdrant
3. **Embedding** da query (com retry, backoff exponencial)
4. **Qdrant search** com filtro opcional de especialidade, top_k ou 50 (o maior)
5. **Hybrid re-ranking**:
   - Stopwords PT-BR hardcoded
   - Keyword boost: 0.02 por termo, 0.05 por bigrama
   - 2ª busca focada em key_terms pra diversificar
6. **Score gate**: se `top_score < 0.55` E sem imagem, rejeita
7. **Context building**: 800 chars por chunk, com [Fonte N: title, p.X-Y]
8. **LLM generation**: gpt-5.4 com imagem, gpt-4o-mini sem imagem
9. **Citation footer**: se resposta não tem "Fonte:" e tem sources, anexa referências

### Specialty normalization

Map frontend label → Qdrant lowercase (linha 2635). 19 entradas. "tórax" → "torax", "músculo esquelético" → "msk".

## Supabase schema (`sql/`)

### `rag_schema.sql` (Postgres canonico de RAG)
9 tabelas:
- `sources` — fontes de dados (pubmed, guideline, book, etc)
- `article_candidates` — itens descobertos pelo pipeline pré-aprovação
- `documents` — base canônica, com source_tier (`canonical`/`update`) e supersedes_document_id
- `document_sections` — capítulos/seções hierárquicas
- `document_contents` — texto bruto/limpo por doc
- `document_chunks` — chunks de RAG com specialty, modality, source_tier
- `ingestion_runs` — log de execução do pipeline
- `review_queue` — fila de revisão humana
- `book_inventory` — catálogo de livros físicos/lógicos antes da ingestão

### `multimodal_schema.sql`
- `document_images` — imagens extraídas por documento
- `image_links` — chunk ↔ image (referência tipo "Figure 3.2")

### Outras migrations
- `2026-04-09_curated_articles.sql` — fila editorial de artigos (1/dia)
- `2026-04-09_shifts_sync.sql` — sync de escalas
- `2026-04-26_challenge_images.sql` — colunas image_url/image_base64 no challenge_question_pool + challenge_questions
- `sources_seed.sql` — seeds de fontes

## Scripts (`scripts/`)

54 arquivos. Maioria é CBR (Concurso Brasileiro de Radiologia):
- 18 scripts CBR (extract, ingest, dedup, ocr, debug, final)
- `article_hunter.py` — busca artigos externos via FlareSolverr + GPT-4o eval
- `publish_curated_article.py` — publica 1 artigo curado/dia
- `audit_text_quality.py`, `review_problem_chunks.py`
- `aria_50_perguntas.py`, `aria_test.py` — testes do ARIA

CBR ingestado (commits 5689c03 + 4be003f): **327 questões** de provas reais (RDDI 2024/2025/2020, USG 2019/2023 V1/V2) com **157 imagens embutidas em base64**.

## Pendências / bugs ativos

### MEMORY.md desatualizado em vários pontos
- Caminho do frontend é `web/`, não `frontend/` (vanilla legado coexiste mas não é o principal)
- Modelo padrão é **gpt-5.4-mini** (não gpt-4o) e **gpt-5.4** pra visão (não gpt-4o-mini)
- Supabase project é `pcdequsipbkxcfsewiow.supabase.co` (não `jsgwakijinaneuzfxywg` — esse é de outro projeto)

### Bugs conhecidos nos commits
- `L.from(...).eq is not a function` no AriaPage ao carregar chats (mencionado no MEMORY, não confirmado resolvido)
- `fix: close unclosed div in Create.jsx` (build error) — resolvido
- `gpt-5.4-nano usa max_completion_tokens` — resolvido (`cba6e16`)
- `challenge: copy_pool_to_challenge` falhas → adicionado debug endpoint
- `EditPanel: 480px side panel not full-width overlay` — resolvido (`d78bc20`)

### Debts técnicos observados
- **30 endpoints num único arquivo** (`main.py` 3020 linhas) — falta modularização
- **CORS hardcoded** com lista de origens (linha 188) — fácil de esquecer quando adicionar novo domínio
- **Imports locais repetidos**: `import httpx`, `import uuid`, `import json` aparecem várias vezes dentro de funções em vez de top-level
- **Sync OpenAI client em rotas async** — usa `asyncio.to_thread` em alguns lugares, sync direto em outros
- **Postgres sem índice** em várias queries pesadas (challenge_responses, challenge_questions)
- **Cleanup de shifts**: `DELETE FROM shifts WHERE id != '00000000...'` — perigoso, depende do UUID zero
- **System prompt ARIA inline** com 80+ linhas (377–459) — devia estar em arquivo `prompts/`
- **Validate password**: backend não valida força da senha, só Supabase Auth
- **Rate limiter**: 30 req/min global, 60 req/min em chat — pode bloquear uso real
- **JWT decoding sem verificação de assinatura** (linha 275): confia na assinatura do issuer, depois valida via `profiles` table

### Coisas que funcionam
- Auth Supabase completa (signup, login, perfil, roles)
- RAG híbrido com retrieval + keyword boost
- Streaming SSE de tokens com cancelamento (AbortController no frontend)
- 327 questões CBR reais com imagens, pool reutilizável
- 4 planos de pricing (Free, Pro R$297, Squad R$227, Command custom)
- Programa de embaixadores
- Geração de imagem via gpt-image-1.5 pra slides

### Coisas com lacunas
- **C2R vs C3 do CBR**: protótipo mostrava que C2 era intermediário, mas no estudo completo tem só C1, C2, C3R (random). O **C3 (não-random) tem só 25 calls** — protótipo só, não foi expandido
- **Ingestão RAG**: pipeline existe mas não rodei pra confirmar cobertura (claim é 117k chunks, 9 especialidades, 520 docs — não verifiquei Qdrant)
- **eX Calculator**: declarado nos pillars mas não vi nenhum código correspondente
- **eX Academy** (microlessons com avatar): só declarado na landing, sem implementação visível

## Configuração e deploy

### Backend (Railway)
- `Dockerfile` standalone com Python 3.12-slim, user não-root
- `railway.json` presente
- `Procfile` presente (fallback)
- `render.yaml` presente (alternativa Render)
- Env vars necessárias: `OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`, `OPENAI_EMBED_MODEL`, `MIN_RELEVANCE_SCORE`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PORT`

### Frontend (Vercel)
- `vercel.json` configura build em `web/`, SPA rewrites
- Build: `cd web && npm install && npm run build`
- Output: `web/dist`

### URLs de produção
- Backend: `https://aria-backend-production-176b.up.railway.app`
- Frontend: `https://victorvignal.github.io` (ou `radioexperience.com.br`)
- Supabase: `https://pcdequsipbkxcfsewiow.supabase.co`
- Custom domains: `radioexperience.com.br`, `victorvignal.me`

## Próximos passos sugeridos

1. **Modularizar `main.py`** — separar em routers (`chat.py`, `shifts.py`, `challenge.py`, `feed.py`, `studylab.py`)
2. **Mover system prompts** para `prompts/` (estão inline no `main.py`)
3. **Validar JWT com assinatura** (não só decode) usando JWKS do Supabase
4. **Limpar duplicação de imports** locais (`import httpx`, `import json` dentro de funções)
5. **Migrar frontend legado** `frontend/index.html` (vanilla) — ou remover ou consolidar com `web/`
6. **Atualizar MEMORY.md e radioexperience_RESUMO.md** com stack real
7. **Documentar fluxo CBR → Challenge** (extração → ingest → pool → challenge)
8. **Implementar eX Calculator** (declarado nos pillars)
9. **Implementar eX Academy** ou remover da landing
10. **Adicionar testes** — backend não tem `tests/`, frontend tem só config ESLint

## Convenção de commits

- `feat:` — feature
- `fix:` — bug
- `docs:` — docs
- `refactor:` — refactor
- `chore:` — config/deps
- `perf:` — perf
- Commits em PT-BR informal ("feat(Create): UI do histórico de versões")

## Glossário interno

- **ARIA** — assistente de radiologia (chat principal)
- **eX StudyLab** — gerador de conteúdo educacional (6 templates)
- **eX Academy** — microlessons (declarado, não implementado)
- **eX Teams** — gestão de equipes/escalas
- **eX Calculator** — calculadoras radiológicas (declarado, não implementado)
- **eX Challenge** — quiz humano vs IA
- **CBR** — Concurso Brasileiro de Radiologia (provas reais no pool)
- **RDDI** — prova de residência em diagnóstico por imagem
- **USG** — ultrassonografia
- **Embaixador** — programa de afiliados com revenue share
