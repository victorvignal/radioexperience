# Retrieval local sobre staging

## Objetivo
Validar rapidamente se o pipeline está gerando chunks úteis antes de gastar embedding/API/Qdrant.

## Script
`radioexperience/scripts/staging_search.py`

## O que ele faz
- lê os JSONs do staging
- normaliza a consulta para busca simples
- ranqueia os chunks por ocorrência dos termos
- mostra páginas, quantidade de imagens vinculadas e preview do texto

## Exemplo
```powershell
python .\radioexperience\scripts\staging_search.py --input .\radioexperience\data\staging\mama_pilot_v6 --query "ginecomastia mamografia" --top 5
```

## Leitura do teste inicial
No teste com `ginecomastia mamografia`, os primeiros resultados vieram da apostila de mama e recuperaram chunks com imagens vinculadas, o que é um bom sinal para validação pré-indexação.

## Limitações
- busca lexical simples, sem embeddings
- quando o JSON só tem `chunk_sample`, a busca continua parcial
- serve para auditoria local rápida, não para avaliação final de retrieval

## Melhoria aplicada
O `rad_ingest.py pilot` agora aceita `--export-full-chunks`, gravando `all_chunks` no JSON.
Quando `all_chunks` existe, o `staging_search.py` usa esse conteúdo completo em vez do sample.

## Exemplo com chunks completos
```powershell
python .\radioexperience\scripts\rad_ingest.py pilot --input .\radioexperience\data\raw\mama --limit 2 --output-dir .\radioexperience\data\staging\mama_pilot_v7_full --images-dir .\radioexperience\data\processed\images --export-full-chunks
python .\radioexperience\scripts\staging_search.py --input .\radioexperience\data\staging\mama_pilot_v7_full --query "calcificações mamografia" --top 5
```

## Leitura do teste com chunks completos
No `mama_pilot_v7_full`, a busca passou a rodar sobre **240 chunks reais** de 2 documentos. Para `calcificações mamografia`, os resultados vieram fortemente do livro `100 principais diagnósticos`, com múltiplos chunks relevantes e imagens vinculadas.

## Próximo passo natural
Melhorar a limpeza de palavras coladas residuais para que o texto indexado fique mais legível e pesquisável.

## Revisão dos piores casos
Para revisar rapidamente os chunks mais suspeitos do lote atual:
```powershell
python .\radioexperience\scripts\review_problem_chunks.py --input .\radioexperience\data\staging\mama_pilot_v8 --top 10
```
Esse script ajuda a focar em poucos chunks com maior chance de ainda conter texto fundido ou OCR ruim.
