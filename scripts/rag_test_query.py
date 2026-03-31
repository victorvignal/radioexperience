import os
from qdrant_client import QdrantClient
from openai import OpenAI

client = QdrantClient(
    url=os.getenv('QDRANT_URL'),
    api_key=os.getenv('QDRANT_API_KEY')
)

oai = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

query = 'Qual a tecnica para ultrassonografia de mama?'
embedding = oai.embeddings.create(input=[query], model='text-embedding-3-small').data[0].embedding

results = client.query_points(
    collection_name='radioexperience_knowledge',
    query=embedding,
    limit=3
)

for i, hit in enumerate(results.points, 1):
    payload = hit.payload
    print(f'--- RESULTADO {i} (score: {hit.score:.4f}) ---')
    print(f'Fonte: {payload.get("title", "?")}')
    print(f'Paginas: {payload.get("page_start")}-{payload.get("page_end")}')
    text = payload.get('text', '')[:600]
    print(text)
    print()
