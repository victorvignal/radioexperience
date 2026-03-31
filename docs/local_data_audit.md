# Auditoria local — 2026-03-27

## Inventário rápido
- PDFs brutos em `data/raw/mama/`: **17**
- Outras pastas de `data/raw/` existem, mas ainda estão vazias no workspace atual
- Lotes de staging já presentes: `mama_pilot`, `mama_pilot_full`, `mama_pilot_v2` ... `mama_pilot_v9`
- Diretórios de imagens já extraídas em `data/processed/images/`: múltiplos livros de mama já processados

## Leitura do lote piloto atual (`mama_pilot_v10`)
- 2 documentos
- 240 chunks
- 507 imagens vinculadas no lote
- heurísticas antigas de auditoria continuam zerando hifenização e colagem com `é`
- a revisão manual mostra que o ruído residual agora é mais de OCR/espaçamento do que de colagem simples

## O que mudou no script
`scripts/rad_ingest.py` agora:
- preserva `page_start`, `page_end` e `page_numbers`
- gera chunks com metadata por faixa de páginas
- vincula imagens aos chunks por página e referência de figura
- permite `index --images-dir ...`
- adiciona `analyze-staging` para auditoria rápida dos JSONs gerados
- recebeu uma nova passada conservadora de correções para colagens residuais (ex.: `comaidade`, `realizarorastreamento`, `imagemàesquerda`)
- já gerou o lote `mama_pilot_v10`, confirmando que o próximo gargalo principal é OCR/espaçamento e não mais hifenização básica

## Próxima execução interna recomendada
```powershell
python .\radioexperience\scripts\review_problem_chunks.py --input .\radioexperience\data\staging\mama_pilot_v10 --top 10
python .\radioexperience\scripts\staging_search.py --input .\radioexperience\data\staging\mama_pilot_v10 --query "ginecomastia mamografia" --top 5
python .\radioexperience\scripts\audit_text_quality.py --input .\radioexperience\data\staging\mama_pilot_v10
```

## Observação
O `v10` já foi gerado e validado localmente. Nesta rodada, a calibração do `review_problem_chunks.py` já reduziu bastante a dominância de falso positivo por token longo legítimo. O próximo ciclo deve focar em materializar a nova limpeza OCR no `v11` e comparar os rankings.
