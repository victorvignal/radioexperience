# Pilot status — Mama

## Status atual
Pipeline refinado e validado em 3 arquivos de mama.

## Candidatos piloto
1. Assessing and Improving the Interpretation of Breast...
2. Apostila Mama Radiocurso
3. 100 Principais Diagnósticos — Mama

## Resultado do último piloto
- Livro 1: 315 chunks / 356 imagens
- Livro 2: 105 chunks / 151 imagens
- Livro 3: 49 chunks / 11 imagens

## Leitura
- pipeline já está usável para piloto real
- captions ainda podem melhorar
- chunking saiu do estado bruto
- o pipeline agora preserva melhor `page_start`, `page_end`, `page_numbers` e vínculos chunk↔imagem no próprio payload

## Versão atual de referência: `mama_pilot_v12` ✅

**v12 é o lote canônico atual** (2026-03-28):
- 277 chunks / 523 imagens nos 3 livros piloto
- `stuck_e: 0`, `hyphen_breaks: 0`, `likely_fused_tokens: 0`
- Limpeza OCR do v11 preservada + regressão de é-fusions corrigida

### O que foi corrigido e melhorado no v12 (session 2026-03-28)
1. **Bug de ordem em `fix_stuck_words()`**: Passada "juntar acento espaçado" agora roda ANTES de "separar é-fusions"
2. **Split de é-fusions com vogal antes**: `nóduloédifícil` → `nódulo é difícil`
3. **Split de abreviação+é**: `USéusado`, `RMéo` → `US é usado`, `RM é o`
4. **Split de à-preposition fusions**: `adicionadoàlidocaína` → `adicionado à lidocaína`
5. **Novos direct_replacements**: `todooprocedimento`, `formaase`, `arésugado`, `seringaea`, etc.
6. **`audit_text_quality.py`**: regex `stuck_e` refinada (vowel+é heuristic, 0 falsos positivos)
7. **`review_problem_chunks.py`**: `ocr_spaced_tokens` exclui `é` e `à` (preposições legítimas)

**Score máximo de ruído**: 8/chunk (antes: 34/chunk)

## Histórico dos lotes

| Lote | Chunks | Imagens | Hifens quebrados | 'é' colado |
|------|--------|---------|-----------------|------------|
| v4 | 469 | 518 | não medido | não medido |
| v6 | 284 | 518 | não medido | não medido |
| v7_full | 240 | 507 | 86 | 232 |
| **v8** | **240** | **507** | **0** | **1** |
| **v9** | **240** | **507** | **0** | **0** |
| **v10** | **240** | **507** | **0** | **0** |
| v11 | 283 | 518 | 0 | 0 (falso — regressão detectada) |
| **v12** | **277** | **~523** | **0** | **0** ✅ |

Auditoria local adicional (`audit_text_quality.py`) no `mama_pilot_v10`:
- `hyphen_breaks`: 0
- `stuck_e`: 0 pela regra conservadora atual
- `likely_fused_tokens`: 0 pela regra conservadora atual

## Estado do staging existente
- `mama_pilot_v4` foi gerado antes dessa melhoria, então ainda não traz pages/linkagem rica nos JSONs
- `mama_pilot_v5` já trouxe metadata de páginas + imagens, mas ainda deixava alguns chunks pequenos/feios em páginas longas
- `mama_pilot_v6` já aplica merge de chunks pequenos adjacentes e ficou mais estável para auditoria manual
- análise local do `mama_pilot_v6`: 3 docs, 284 chunks, 518 imagens, 229 chunks com imagens vinculadas

## Próximo passo
1. Gerar um `mama_pilot_v11` com a nova limpeza OCR/espaçamento já adicionada ao `rad_ingest.py`
2. Comparar o topo do `review_problem_chunks.py` entre `v10` e `v11` para medir queda real dos artefatos OCR
3. Rodar indexação real com OpenAI embeddings + Qdrant configurados

## Comandos
```powershell
python .\radioexperience\scripts\review_problem_chunks.py --input .\radioexperience\data\staging\mama_pilot_v10 --top 10
python .\radioexperience\scripts\staging_search.py --input .\radioexperience\data\staging\mama_pilot_v10 --query "ginecomastia mamografia" --top 5
python .\radioexperience\scripts\audit_text_quality.py --input .\radioexperience\data\staging\mama_pilot_v10
.\radioexperience\scripts\run_mama_pilot_index.ps1
```
