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
- `fix_specialty_payload.py` — corrige metadata de specialty
- `audit_text_quality.py` — auditoria de qualidade dos chunks
- `review_problem_chunks.py` — identifica chunks problemáticos
