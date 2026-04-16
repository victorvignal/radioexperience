# RadioeXperience — Resumo Completo

> Documentação essencial do projeto. Onde tudo está e o que cada coisa faz.

---

## Visão Geral

**RadioeXperience** é uma plataforma de educação em radiologia alimentada por IA, usando RAG (Retrieval-Augmented Generation) para gerar conteúdo didático personalizado.

- **Stack**: FastAPI (backend) + React (frontend) + Qdrant (vetores) + Supabase (banco/auth)
- **URLs**: 
  - Frontend: `https://victorvignal.github.io`
  - Backend: `https://aria-backend-production-176b.up.railway.app`

---

## Estrutura de Pastas

```
radioexperience/
├── backend/
│   ├── main.py              # TODO: descrever
│   ├── requirements.txt
│   └── ...
├── web/                    # Frontend React
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # Home do usuário logado
│   │   │   ├── Create.jsx         # eX StudyLabs — criar conteúdo
│   │   │   ├── MyProjects.jsx     # Meus Projetos salvos
│   │   │   ├── AriaPage.jsx       # Chat principal ARIA
│   │   │   ├── ChallengePage.jsx  # ARIA Challenge — quiz
│   │   │   ├── Feed.jsx           # Feed público
│   │   │   ├── PostView.jsx       # Ver post individual
│   │   │   ├── ArticleUpload.jsx  # Upload de artigos
│   │   │   ├── AdminUsers.jsx     # Painel admin — usuários
│   │   │   ├── AdminUpload.jsx    # Painel admin — upload
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── ProfileSetup.jsx
│   │   │   ├── Teams.jsx
│   │   │   ├── UserProfile.jsx
│   │   │   └── Vagas.jsx
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx    # Auth global
│   │   ├── components/
│   │   │   └── ProtectedRoute.jsx
│   │   └── lib/
│   │       ├── supabase.js        # Cliente Supabase
│   │       ├── postImages.js      # Upload de imagens de posts
│   │       └── avatar.js
│   └── package.json
├── docs/
│   ├── radioexperience_MEMORIA.md  # Histórico de mudanças
│   └── radioexperience_RESUMO.md   # Este arquivo
├── docker-compose.yml              # Backend + Qdrant local
├── Dockerfile
├── README.md
├── prompts/                        # System prompts do backend
│   ├── SYSTEM_PROMPT_*.txt
│   └── CHALLENGE_*.txt
└── sql/                            # Scripts SQL para Supabase
```

---

## Backend — `main.py` (ENDPOINTS)

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/callback` | Callback OAuth (Supabase) |
| GET | `/auth/user` | Retorna usuário atual |

### Chat Principal (RAG)
| Método | Endpoint | Modelo | Descrição |
|--------|----------|--------|-----------|
| POST | `/chat` | `gpt-5.4-mini` | Chat principal com RAG |
| POST | `/chat/edit` | `gpt-5.4-mini` | Editar conteúdo existente |

### Criação de Conteúdo (eX StudyLabs)
| Método | Endpoint | Modelo | Descrição |
|--------|----------|--------|-----------|
| POST | `/criar/script` | `gpt-5.4-mini` | Script de aula |
| POST | `/criar/slides` | `gpt-5.4-mini` | Slides didáticos |
| POST | `/criar/mapa_mental` | `gpt-5.4-mini` | Mapa mental (markmap no frontend) |
| POST | `/criar/tabela` | `gpt-5.4-mini` | Tabela comparativa |
| POST | `/criar/questoes` | `gpt-5.4-mini` | Questões de estudo |
| POST | `/criar/caso_clinico` | `gpt-5.4-mini` | Caso clínico |

### Imagens
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/image/generate` | Gera imagem via DALL-E (para scripts) |

### Feed / Posts
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/feed/articles` | Criar artigo |
| GET | `/feed/articles` | Listar artigos |
| GET | `/feed/articles/{id}` | Ver artigo |
| POST | `/posts` | Criar post |
| GET | `/posts` | Listar posts |
| GET | `/posts/{id}` | Ver post |
| DELETE | `/posts/{id}` | Deletar post |

### Admin
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/admin/upload` | Upload de documentos para RAG |
| GET | `/admin/users` | Lista usuários |
| GET | `/admin/stats` | Estatísticas |

### Challenge (Quiz)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/challenge/generate` | Gera questões desafio |
| POST | `/challenge/submit` | Submete resposta |
| GET | `/challenge/leaderboard` | Ranking |

### Shifts (?)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/shifts` | Lista shifts |

---

## Frontend — Pages

### `Dashboard.jsx`
- **rota**: `/`
- **descrição**: Home do usuário logado. Mostra:
  - Banner de boas-vindas
  - **Ferramentas** (ToolCard grid): ARIA, ARIA Challenge, eX StudyLabs, eX Teams
  - Feed de posts recentes

### `Create.jsx`
- **rota**: `/criar`
- **descrição**: eX StudyLabs — criar conteúdo didático.
- **Templates**: Script, Slides, Mapa Mental, Tabela, Questões, Caso Clínico
- **Fluxo**: 
  1. Seleciona template + tema + especialidade (opcional) + nível (opcional)
  2. Gera conteúdo via API `/criar/{template}`
  3. Mostra preview/editável
  4. Publica ou salva como projeto
- **Painel de Edição**: Slide-in lateral que chama `/chat/edit` para editar conteúdo via chat
- **Estados**: `generating`, `generatedContent`, `editedContent`, `showPreview`, `showEditPanel`, `publishing`, `savingProject`
- **Marker**: `mode` de navegação: `create` | `edit`

### `MyProjects.jsx`
- **rota**: `/meus-projetos`
- **descrição**: Lista projetos salvos pelo usuário (Supabase)
- **Ações**: Abrir projeto (volta para Create com conteúdo carregado), deletar, copiar, exportar

### `AriaPage.jsx`
- **rota**: `/aria`
- **descrição**: Chat principal com ARIA (RAG). Semelhante ao painel de edição mas é o chat principal.

### `ChallengePage.jsx`
- **rota**: `/challenge`
- **descrição**: Quiz interativo. Gera questões, usuário responde, revela gabarito.

### `Feed.jsx`
- **rota**: `/feed`
- **descrição**: Feed público de posts/artigos.

### `PostView.jsx`
- **rota**: `/post/{id}`
- **descrição**: Visualização de um post/artigo individual.

### `ArticleUpload.jsx`
- **rota**: `/upload-artigo`
- **descrição**: Upload de artigos para o feed.

### `Login.jsx` / `Signup.jsx` / `AuthCallback.jsx` / `ProfileSetup.jsx`
- Autenticação via Supabase Auth.

### `AdminUsers.jsx`
- **descrição**: Painel admin — visão de todos os usuários + estatísticas.

### `AdminUpload.jsx`
- **descrição**: Upload de documentos para indexação no Qdrant (RAG).

---

## Frontend — Components

### `AuthContext.jsx`
- Provedor de contexto React com estado de autenticação (user, session, loading)
- Usa Supabase Auth

### `ProtectedRoute.jsx`
- HOC que redireciona para `/login` se usuário não autenticado

### `supabase.js`
- Cliente Supabase configurado

### `postImages.js`
- Funções para upload e preview de imagens de posts

---

## Banco de Dados — Supabase

### Tabelas Principais

**`public.users`** (estende auth.users)
```sql
- id uuid (PK, refs auth.users)
- email text
- display_name text
- specialty text
- institution text
- role text ('user' | 'staff' | 'admin')
- created_at timestamptz
```

**`public.posts`**
```sql
- id uuid PK
- user_id uuid references auth.users
- type text ('aula','slides','mapa_mental','tabela','questoes','caso_clinico','post','article','case','review','news','vaga')
- title text
- content text
- visibility text ('public'|'private'|'draft')
- specialty text
- level text
- image_url text
- published_at timestamptz
- created_at timestamptz
- updated_at timestamptz
```

**`public.shifts`** (não sei bem o que é — schedule/grade?)
```sql
- id uuid PK
- location text
- room text
- day_of_week text
- time_slot text
- doctor_name text
- status text
- specialty text
- batch_id text
- source_file text
- created_at timestamptz
```

---

## RAG — Qdrant

### Collection: `radiology`
- **Dimensão**: 1536 (OpenAI `text-embedding-3-small`)
- **Dados**: Documentos de radiologia indexados por `/admin/upload`
- **Campos payload**: `title`, `text`, `specialty`, `page_start`, `page_end`, `source`

---

## Modelos OpenAI Usados

| Modelo | Uso |
|--------|-----|
| `gpt-5.4-mini` | Geração principal (chat, criação, challenge) |
| `gpt-4o-mini` | Descrição de imagens (análise de imagem no chat/edit) |
| `gpt-4o` | Geração com imagem (quando imagem é enviada) |
| `text-embedding-3-small` | Embeddings para RAG |

---

## Variáveis de Ambiente

### Backend (.env)
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://pcdequsipbkxcfsewiow.supabase.co
SUPABASE_SERVICE_KEY=...
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=...
```

### Frontend (.env)
```
VITE_ARIA_API=https://aria-backend-production-176b.up.railway.app
```

---

## Fluxos Importantes

### 1. Criar e Publicar Conteúdo (eX StudyLabs)
```
Dashboard → /criar → Create.jsx
  1. Seleciona template (script/slides/mapa_mental/etc)
  2. Digita tema + especialidade/nível (opcionais)
  3. POST /criar/{template} → conteúdo gerado
  4. Edita no próprio editor ou abre painel ARIA Edit (/chat/edit)
  5. Publica → POST /posts ou /feed/articles
```

### 2. Salvar e Carregar Projeto
```
Create.jsx → Salvar
  → POST para Supabase (tabela posts, visibility='draft')
  
Meus Projetos → Abrir
  → navigate('/criar', { state: { project } })
  → Create.jsx carrega do location.state
  → sessionStorage como backup
```

### 3. Chat RAG
```
AriaPage.jsx → POST /chat
  → Embedding do texto → busca Qdrant
  → GPT-5.4-mini com contexto RAG
  → Resposta + sources
```

### 4. Upload para RAG
```
AdminUpload.jsx → POST /admin/upload
  → Extrai texto do PDF
  → Chunking
  → Embedding + upsert no Qdrant
```

---

## Cores e Design System

Paleta em `Create.jsx` (referência para todas as pages):
```js
const C = {
  bg: '#001a2b',
  bgDeep: '#002233',
  glass: 'rgba(192,214,234,0.07)',
  glassHover: 'rgba(192,214,234,0.13)',
  glassBorder: 'rgba(192,214,234,0.15)',
  border: 'rgba(192,214,234,0.1)',
  text: '#F6F2E8',
  textSoft: '#C0D6EA',
  textMuted: '#8ba8c4',
  textDim: '#5a7d9a',
  accent: '#DDFF55',         // Verde-amarelo (primário)
  accentGlow: 'rgba(221,255,85,0.15)',
  accentSoft: 'rgba(221,255,85,0.08)',
  green: '#5ef0b0',
  greenGlow: 'rgba(94,240,176,0.15)',
  blue: '#7ecbff',
  blueGlow: 'rgba(126,203,255,0.15)',
  red: '#ff6b6b',
}
```

---

## Perguntas em Aberto

1. **Shifts** — O que exatamente é a tabela `shifts`? Parece agenda de plantões mas não tenho certeza.
2. **eX Teams** — O que é exatamente? Mais detalhes necessários.
3. **Article Hunter** — Como funciona o resumo rico com IA (`65b47fc`)? Precisa documentar.
4. **Markmap** — O mapa mental usa markmap no frontend. Qual a library exata?

---

_Última atualização: 2026-04-16_
