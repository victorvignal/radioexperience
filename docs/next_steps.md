# Next Steps — RadioeXperience

> Updated: 2026-03-30 (cron auto)

## Status Summary

### Indexação Qdrant (live)
- **Collection:** `radioexperience_knowledge`
- **Total chunks:** ~100.868 e crescendo
- **Especialidades:** geral (39.7K), neurorradiologia (15.1K), pediatria (14.3K), intervenção (12.4K), abdome (11.5K), msk (4.1K), mama (1.3K), radioprotecao (1.1K), tórax (726)
- **Tipos:** book (97.3K), guideline (3K), article (494)
- **Remaining unknown:** 118 chunks, 482 duplicatas

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

### 1. Fix remaining 118 unknown chunks
- Provavelmente paths com estrutura não-padrão
- Rodar `check_unknowns.py` para identificar

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
