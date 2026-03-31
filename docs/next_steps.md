# Next Steps — RadioeXperience

> Updated: 2026-03-30 (cron auto)

## Status Summary

### Indexação Qdrant (live)
- **Collection:** `radioexperience_knowledge`
- **Total chunks:** 117.191
- **Especialidades:** geral (39.694), unknown (16.441), neurorradiologia (15.118), pediatria (14.346), intervenção (12.403), abdome (11.479), msk (4.087), mama (1.283), radioprotecao (1.132), tórax (726), _duplicates (482)
- **Tipos:** book (113.643), guideline (3.054), article (494)
- **Indexer em execução:** não (só uvicorn rodando)

### Backend
- FastAPI rodando em `http://127.0.0.1:8000`
- Endpoints: `/health`, `/chat` (RAG com GPT-4o-mini)
- CORS: open (restringir em produção)

### Frontend
- Chat widget em `radioexperience/frontend/index.html`
- Dark theme, sugestões, fontes citadas
- Conecta ao backend localhost

### Pipeline
- `rad_ingest.py` v12: specialty inference from path ✅
- `fix_specialty_payload.py`: corrige chunks antigos ✅
- `count_by_field.py`: auditoria por specialty/type ✅
- `check_unknowns.py`: identifica chunks sem specialty ✅

---

## Immediate Next Steps

### 1. Fix remaining ~16.4K unknown chunks
- Paths com estrutura não-padrão ainda sem specialty
- Rodar `check_unknowns.py` e aplicar `fix_specialty_payload.py`

### 2. Deploy do backend
- Dockerfile para Railway/Render/Fly
- Precisa de variáveis de ambiente: OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY

### 3. Integração frontend → site
- Adicionar chat como seção ou página separada no victorvignal.github.io
- Ou manter como app standalone

### 4. Limpar duplicatas
- 482 chunks em `_duplicates` — remover ou manter com flag

---

## Cron
- Job `ARIA Project Continuation` rodando a cada 45min
- Verifica status e continua de onde parou
