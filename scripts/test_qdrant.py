from qdrant_client import QdrantClient
q = QdrantClient(
    url='https://664bcae7-7a94-4933-b917-69d01b830eb4.sa-east-1-0.aws.cloud.qdrant.io',
    api_key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.-tz-MHjwxomKu1Cb5-DjFl1qLi4qsgqa7_JbBveT5Hg',
    check_compatibility=False, timeout=60
)
# Test scroll
batch, offset = q.scroll(collection_name='radioexperience_knowledge', limit=5, with_payload=['path','specialty'])
for p in batch:
    sp = p.payload.get('specialty')
    path = p.payload.get('path', '')[:80]
    print(f'id={str(p.id)[:8]}... special={sp} path={path}')
print('Scroll OK')
# Test set_payload
if batch:
    q.set_payload(collection_name='radioexperience_knowledge', payload={'specialty':'test'}, points=[batch[0].id])
    print('set_payload OK')
    q.set_payload(collection_name='radioexperience_knowledge', payload={'specialty':None}, points=[batch[0].id])
    print('Revert OK')
