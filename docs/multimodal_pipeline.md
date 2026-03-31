# Pipeline multimodal inicial

## Objetivo
Preservar o valor visual dos livros de radiologia sem tentar resolver visão completa em toda a base.

## Etapas
1. Extrair texto do PDF
2. Extrair imagens por página quando possível
3. Salvar imagens em `data/processed/images/`
4. Salvar metadata da imagem:
   - documento
   - página
   - índice da imagem
   - legenda (se encontrada)
5. Indexar texto normalmente
6. Criar vínculo entre chunks e imagens associadas

## Estratégia de vinculação
- por mesma página
- por referência de figura no chunk
- por seção/capítulo

## Consulta
- busca textual primeiro
- se houver imagem vinculada relevante, anexar referência
- só chamar modelo multimodal quando necessário
