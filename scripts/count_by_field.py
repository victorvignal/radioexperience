from qdrant_client import QdrantClient
q = QdrantClient(
    url='https://664bcae7-7a94-4933-b917-69d01b830eb4.sa-east-1-0.aws.cloud.qdrant.io',
    api_key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.-tz-MHjwxomKu1Cb5-DjFl1qLi4qsgqa7_JbBveT5Hg',
    check_compatibility=False, timeout=60
)
specialties = {}
types = {}
offset = None
total = 0
while True:
    batch, offset = q.scroll(collection_name='radioexperience_knowledge', limit=500, offset=offset, with_payload=['specialty','document_type'])
    if not batch:
        break
    for pt in batch:
        s = pt.payload.get('specialty') or 'unknown'
        t = pt.payload.get('document_type') or 'unknown'
        specialties[s] = specialties.get(s, 0) + 1
        types[t] = types.get(t, 0) + 1
        total += 1
    if offset is None:
        break
print(f'Total: {total}')
print('\nBy specialty:')
for k, v in sorted(specialties.items(), key=lambda x: -x[1]):
    print(f'  {k}: {v}')
print('\nBy document type:')
for k, v in sorted(types.items(), key=lambda x: -x[1]):
    print(f'  {k}: {v}')
