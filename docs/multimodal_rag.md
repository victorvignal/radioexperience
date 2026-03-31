# Multimodal RAG — RadioeXperience

## Objetivo
Adicionar uma camada visual ao RAG textual, sem tentar fazer visão pesada em toda a base logo de cara.

## Estratégia
### Camada 1 — Texto (principal)
Indexar:
- capítulos
- seções
- legendas
- referências de figura
- tabelas e trechos relevantes

### Camada 2 — Imagens (associadas ao texto)
Para cada figura relevante, guardar:
- imagem exportada
- legenda
- página
- documento
- seção associada
- caminho do arquivo

### Camada 3 — IA multimodal sob demanda
Usar modelo multimodal apenas quando:
- o usuário enviar uma imagem
- a pergunta exigir comparação visual
- houver figura associada importante para responder

## Fluxo de ingestão
PDF/livro
→ extrai texto
→ extrai figuras/imagens
→ extrai ou vincula legenda
→ associa à página/seção
→ indexa texto no vetor
→ salva imagem no storage

## Fluxo de consulta
Pergunta do usuário
→ busca textual no Qdrant
→ recupera chunks relevantes
→ verifica figuras associadas
→ se necessário, envia texto + figura para modelo multimodal
→ responde

## MVP recomendado
- texto indexado
- legendas preservadas
- imagens importantes exportadas
- multimodal só em casos específicos

## Não fazer agora
- indexar todas as imagens da base inteira
- rodar visão em todos os PDFs
- transformar o pipeline todo em multimodal de uma vez
