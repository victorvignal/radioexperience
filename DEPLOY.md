# Deploy — ARIA Backend

## Opção 1: Railway (recomendado — mais simples)

1. Acesse [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Conecte o repositório `radioexperience`
4. Adicione as variáveis de ambiente:
   - `OPENAI_API_KEY` = sua chave OpenAI
   - `QDRANT_URL` = URL do seu cluster Qdrant
   - `QDRANT_API_KEY` = sua chave Qdrant
   - `QDRANT_COLLECTION` = radioexperience_knowledge
5. Railway detecta o `Dockerfile` e faz deploy automático
6. Copie a URL gerada (ex: `aria-backend.up.railway.app`)

## Opção 2: Render

1. Acesse [render.com](https://render.com)
2. "New" → "Web Service"
3. Conecte o repositório
4. Render detecta o `render.yaml` automaticamente
5. Preencha as variáveis de ambiente
6. Deploy

## Opção 3: Fly.io

```bash
fly launch
fly secrets set OPENAI_API_KEY=... QDRANT_URL=... QDRANT_API_KEY=...
fly deploy
```

## Após o deploy

1. Copie a URL do backend (ex: `https://aria-backend.up.railway.app`)
2. Atualize o frontend: adicione `?api=https://aria-backend.up.railway.app/chat` na URL
3. Ou defina `window.ARIA_API_URL` antes de carregar o script
4. Teste: `curl https://seu-backend.com/health`

## Variáveis necessárias

| Variável | Descrição |
|----------|-----------|
| OPENAI_API_KEY | Chave de API OpenAI (sk-...) |
| QDRANT_URL | URL do cluster Qdrant Cloud |
| QDRANT_API_KEY | Chave de API Qdrant |
| QDRANT_COLLECTION | Nome da collection (padrão: radioexperience_knowledge) |
| OPENAI_EMBED_MODEL | Modelo de embedding (padrão: text-embedding-3-small) |

**Nunca commite chaves de API no repositório.** Use painéis de variáveis de ambiente do Railway/Render/Fly.
