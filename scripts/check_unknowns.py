from qdrant_client import QdrantClient
q = QdrantClient(
    url='https://664bcae7-7a94-4933-b917-69d01b830eb4.sa-east-1-0.aws.cloud.qdrant.io',
    api_key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.-tz-MHjwxomKu1Cb5-DjFl1qLi4qsgqa7_JbBveT5Hg',
    check_compatibility=False, timeout=60
)
unknown_titles = {}
offset = None
while True:
    batch, offset = q.scroll(
        collection_name='radioexperience_knowledge',
        limit=500, offset=offset,
        with_payload=['specialty','title','path'],
    )
    if not batch:
        break
    for pt in batch:
        sp = pt.payload.get('specialty')
        if sp is None or sp == 'unknown' or sp == '_duplicates':
            title = pt.payload.get('title','?')
            path = pt.payload.get('path','?')
            key = f'{sp}|{title}'
            if key not in unknown_titles:
                unknown_titles[key] = path
    if offset is None:
        break
print(f'Unknown/duplicate docs ({len(unknown_titles)}):')
for k, v in sorted(unknown_titles.items()):
    spec, title = k.split('|', 1)
    print(f'  [{spec}] {title}')
    print(f'    -> {v}')
