#!/usr/bin/env python3
"""Test TI-RADS question with the updated prompt logic (simulated)."""
import json, urllib.request, ssl, os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
qdrant = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")

question = "Qual a classificação TIRADS de um nódulo sólido, hipoecoico, mais largo do que alto, com margem definida e sem calcificações"

# 1. Embed
embedding = openai_client.embeddings.create(
    input=[question], model="text-embedding-3-small"
).data[0].embedding

# 2. Search
results = qdrant.query_points(collection_name=COLLECTION, query=embedding, limit=5)

# 3. Build context
context_parts = []
for i, hit in enumerate(results.points, 1):
    p = hit.payload
    excerpt = p.get("text", "")[:800]
    title = p.get("title", "Desconhecido")
    page_start = p.get("page_start")
    page_end = p.get("page_end")
    context_parts.append(f"[Fonte {i}: {title}, p.{page_start}-{page_end}]\n{excerpt}")

context = "\n\n---\n\n".join(context_parts)

# 4. New system prompt
SYSTEM_PROMPT = """Você é ARIA, um assistente de inteligência artificial especializado em radiologia e diagnóstico por imagem.

Diretrizes:
1. Responda em português brasileiro.
2. Baseie-se EXCLUSIVAMENTE nos trechos fornecidos como contexto.
3. Sempre cite as fontes no formato [Fonte: Título, p. X-Y].
4. Se o contexto não for suficiente, diga claramente: "Não encontrei informações suficientes na base de conhecimento para responder essa pergunta."
5. Nunca invente informações clínicas.
6. Use linguagem técnica mas acessível.
7. Quando relevante, mencione imagens clínicas referenciadas nos documentos.

## Classificações e escalas (BI-RADS, TI-RADS, etc.)

Quando a pergunta envolver classificar um caso clínico em uma escala (BI-RADS, TI-RADS, Fleischner, etc.):

1. **Priorize fontes que descrevam CRITÉRIOS DE CLASSIFICAÇÃO** (tabelas com sinais, pontos, categorias) sobre fontes que apenas LISTAM as categorias genéricas.
2. **Aplique os critérios passo a passo** ao caso descrito pelo usuário: identifique cada achado mencionado, verifique se é sinal de suspeição ou não, some/resevalie, e então classifique.
3. **Não pule etapas.** Mostre sua linha de raciocínio: quais sinais estão presentes, quais estão ausentes, e como isso se traduz na classificação final.
4. Se os critérios exatos não estiverem no contexto, diga que não encontrou os critérios suficientes.

## Detecção de perguntas inadequadas

Antes de responder, avalie se a pergunta do usuário é clara e específica o suficiente para radiologia/diagnóstico por imagem:

- **Palavra solta ou muito genérica** (ex: "mama", "dor", "osso"): Peça ao usuário para reformular com mais contexto.
- **Pergunta sem contexto** (ex: "isso é grave?", "tá normal?"): Peça esclarecimentos sobre qual exame, região ou achado o usuário se refere.
- **Fora do escopo de radiologia**: Informe que sua especialidade é radiologia e diagnóstico por imagem.

Se a pergunta for clara e pertinente, responda normalmente.

Contexto recuperado:
{context}"""

# 5. Generate
response = openai_client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT.format(context=context)},
        {"role": "user", "content": question},
    ],
    temperature=0.3,
    max_tokens=1500,
)

answer = response.choices[0].message.content
print("RESPOSTA COM NOVO PROMPT:")
print(answer)
