# Pipeline de ingestão inicial — RadioeXperience

## Melhorias aplicadas
- corte de front matter
- remoção de páginas de ruído editorial
- filtro de chunks curtos/lixo
- chunking menos agressivo
- extração multimodal por página

## Resultado esperado
Os primeiros chunks devem começar mais perto do conteúdo clínico, e não de capa/prefácio/copyright.

## Comando de teste
```powershell
python .\radioexperience\scripts\rad_ingest.py pilot --input ".\radioexperience\data\raw\mama" --limit 3 --output-dir ".\radioexperience\data\staging\mama_pilot_v3" --images-dir ".\radioexperience\data\processed\images"
```
