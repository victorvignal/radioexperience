# RadioeXperience — Pipeline RAG (livros + updates semanais)

## 1. Objetivo
Construir uma base de conhecimento para o chat de radiologia com duas camadas:

- **Base canônica:** livros, capítulos, materiais próprios revisados
- **Base dinâmica:** artigos, revisões, guidelines e updates semanais

---

## 2. Arquitetura macro

```text
[LIVROS / PDFs CANÔNICOS]
   ↓
[inventário + parsing + limpeza + seções + chunking + embedding]
   ↓
[Base Canônica]

[ARTIGOS / GUIDELINES / NOVIDADES]
   ↓
[OpenClaw cron: descoberta + triagem + metadata]
   ↓
[staging / article_candidates]
   ↓
[dedupe + aprovação]
   ↓
[extração + chunking + embedding]
   ↓
[Base de Updates]

[CHAT]
   ↓
[retrieval híbrido + rerank + resposta com citações]
```

---

## 3. Fase 1 — Ingestão inicial dos livros

### 3.1 Inventário
Cadastrar todos os livros em `book_inventory` com:
- título
- arquivo
- autores
- edição
- ano
- especialidade
- modalidade
- licença/status

### 3.2 Importação para `documents`
Cada livro entra como:
- `document_type = 'book'`
- `source_tier = 'canonical'`
- `confidence_weight = 0.95` (ajustável)

### 3.3 Parsing
Extrair texto dos PDFs/livros e tentar preservar:
- capítulo
- seção
- subtítulo
- páginas

### 3.4 Seções
Salvar em `document_sections`.

### 3.5 Chunks
Criar chunks por seção/subseção, evitando chunk fixo cego por caracteres.
Sugestão inicial:
- 500 a 900 tokens por chunk
- overlap de 60 a 120 tokens
- preservar título de capítulo e seção no metadata

### 3.6 Embeddings
Gerar embedding para cada chunk e enviar ao Qdrant com payload:
- document_id
- title
- specialty
- modality
- document_type
- source_tier
- chapter_title
- section_title
- page_ref
- published_at
- confidence_weight

---

## 4. Fase 2 — Descoberta semanal automática

### 4.1 O papel do OpenClaw
O OpenClaw **não** deve ser o único responsável pela base final.
Seu papel recomendado:
- buscar novidades
- filtrar relevância
- gerar metadata
- resumir tecnicamente
- salvar em staging (`article_candidates`)

### 4.2 Fluxo semanal
1. cron roda 1x por semana
2. consulta fontes cadastradas
3. busca documentos novos desde `last_checked_at`
4. classifica por relevância
5. grava em `article_candidates`
6. marca duplicados / fila de revisão
7. pipeline técnico ingere os aprovados

---

## 5. Regras de aprovação

### Aprovação automática sugerida
Aprovar automaticamente quando:
- guideline oficial recente
- review relevante com score alto
- artigo original com relevância alta e fonte confiável

### Revisão manual sugerida
Mandar para `review_queue` quando:
- score intermediário
- fonte pouco confiável
- linguagem ambígua
- suspeita de duplicata

### Rejeição automática sugerida
Rejeitar quando:
- fora de radiologia
- sem utilidade clínica/educacional clara
- editorial/comentário com baixo valor de RAG

---

## 6. Dedupe

Checar por:
- DOI
- PMID
- URL canônica
- título normalizado

Se houver versão nova de guideline/documento:
- criar novo `documents.id`
- apontar `supersedes_document_id`
- marcar o antigo como `superseded`

---

## 7. Estratégia de retrieval

### Prioridade por intenção

**Perguntas conceituais / base:**
- priorizar `source_tier = canonical`
- livros, capítulos e guidelines

**Perguntas sobre novidade / atualização:**
- priorizar `source_tier = update`
- artigos recentes, revisões e guidelines novas

**Perguntas mistas:**
- combinar as duas camadas
- responder com base consolidada + atualização recente

---

## 8. Pesos sugeridos

- guideline oficial: `0.98`
- livro canônico: `0.95`
- review robusta: `0.90`
- artigo original: `0.80`
- case report: `0.55`

Esses pesos podem entrar no reranking final.

---

## 9. Stack sugerida

### App
- Next.js
- Tailwind + shadcn/ui
- Supabase (auth + postgres)

### RAG
- Qdrant
- embeddings (OpenAI ou equivalente)
- retrieval híbrido + reranker

### Pipeline
- OpenClaw cron para descoberta
- Python/FastAPI workers para ingestão, parsing, chunking e indexação

---

## 10. Roadmap prático

### Semana 1
- subir schema SQL
- montar inventário dos livros
- cadastrar `sources`

### Semana 2
- importar 1 ou 2 livros piloto
- testar parsing + seções + chunks

### Semana 3
- indexar os livros piloto no Qdrant
- validar qualidade das respostas

### Semana 4
- ativar cron semanal do OpenClaw
- criar staging + aprovação + dedupe
- indexar os primeiros updates

---

## 11. Regra de ouro
A base que o chat consulta deve ser **sempre a base final aprovada**.
Nunca usar diretamente o staging como fonte de resposta.
