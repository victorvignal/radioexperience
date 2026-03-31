# RadioeXperience

Estrutura organizada do projeto de base RAG + ingestão + pesquisa semanal.

## Estrutura

- `docs/`
  - `architecture_pipeline.md` → visão geral da arquitetura
  - `ingestion_pipeline.md` → fluxo de ingestão inicial
  - `multimodal_pipeline.md` / `multimodal_rag.md` → estratégia multimodal
  - `pilot_status.md` / `next_steps.md` / `local_data_audit.md` → status e próximos passos
- `sql/`
  - `rag_schema.sql` → schema do banco principal
  - `sources_seed.sql` → fontes iniciais para discovery
- `prompts/`
  - `openclaw_weekly_discovery_prompt.txt` → prompt do cron/agente semanal
- `scripts/`
  - `rad_ingest.py` → inventário + piloto + indexação inicial
  - `inspect_staging.py` → inspeção rápida de um chunk do staging
  - `staging_search.py` → busca local simples sobre o staging
  - `audit_text_quality.py` → auditoria conservadora de ruído textual no staging
  - `review_problem_chunks.py` → ranqueia chunks mais suspeitos para revisão manual
  - `requirements.txt` → dependências do script
- `checklists/`
  - `books_ingestion_checklist.md` → checklist da ingestão dos livros

## Ordem sugerida
1. Ler `docs/architecture_pipeline.md`
2. Subir `sql/rag_schema.sql`
3. Usar os dados locais em `radioexperience/data/`
4. Rodar `scripts/rad_ingest.py` em modo `inventory`
5. Rodar `pilot` com poucos arquivos
6. Auditar staging localmente (`inspect_staging.py`, `staging_search.py`, `review_problem_chunks.py`)
7. Refinar limpeza textual com base nos piores chunks
8. Só depois indexar
