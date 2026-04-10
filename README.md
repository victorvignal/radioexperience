# RadioeXperience

Assistente de Radiologia por IA — RAG com base de conhecimento real.

## Status (2026-03-30)

- **Backend:** https://aria-backend-production-176b.up.railway.app (FastAPI + RAG)
- **Indexação:** 117.191 chunks no Qdrant (10 especialidades)
- **Frontend:** Chat widget integrado em [victorvignal.github.io](https://victorvignal.github.io#demo)
- **Cron:** Auto-avanço a cada 45min

## Especialidades indexadas

geral, neurorradiologia, pediatria, intervenção, abdome, msk, mama, radioprotecao, tórax

## Estrutura

```
backend/         → FastAPI (main.py, requirements.txt)
frontend/        → Chat widget standalone
scripts/         → Pipeline de ingestão e indexação
docs/            → Documentação técnica
sql/             → Schema do banco
data/            → Dados locais (staging, inventário)
```

## Deploy

Ver [DEPLOY.md](DEPLOY.md) para instruções completas.

```bash
# Local
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Railway
railway up
```

## API Endpoints

- `GET /health` — status da indexação
- `POST /chat` — pergunta RAG (body: `{"question": "...", "top_k": 5}`)

## Scripts principais

- `rad_ingest.py` — ingestão e indexação de PDFs
- `article_hunter.py` — descobre/indexa artigos externos e coloca na fila editorial `curated_articles`
- `publish_curated_article.py` — publica no feed no máximo 1 artigo curado por dia
- `fix_specialty_payload.py` — corrige metadata de specialty
- `audit_text_quality.py` — auditoria de qualidade dos chunks
- `review_problem_chunks.py` — identifica chunks problemáticos

## Curated articles / fila editorial

Agora o fluxo de artigos externos funciona em duas etapas:

1. `python scripts/article_hunter.py` indexa no Qdrant e salva/atualiza o artigo em `public.curated_articles`
2. `python scripts/publish_curated_article.py` publica apenas **1 artigo por dia** no feed, sempre pegando o mais antigo com `status = 'indexed'`

### Cron sugerido no VPS

```bash
cd /root/.openclaw/workspace/radioexperience && /usr/bin/python3 scripts/publish_curated_article.py
```

Exemplo de cron diário às 09:00 (America/Sao_Paulo no servidor/configuração correspondente):

```cron
0 9 * * * cd /root/.openclaw/workspace/radioexperience && /usr/bin/python3 scripts/publish_curated_article.py >> /root/.openclaw/workspace/radioexperience/logs/curated_publish.log 2>&1
```

### Passo manual no Supabase

Rodar a migration `sql/2026-04-09_curated_articles.sql` no SQL Editor antes de usar o publisher diário.
