"""
Fix specialty for chunks that were indexed before the path-based inference was added.
Uses scroll to find null-specialty points and set_payload to update them.

Reads credentials from ../.env (QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION).
"""
import os
import time
from pathlib import Path
from collections import defaultdict
from dotenv import load_dotenv
from qdrant_client import QdrantClient

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

qdrant = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY"),
    check_compatibility=False, timeout=60
)
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")

def infer_from_path(path_str):
    parts = Path(path_str).parts
    specialty = None
    doc_type = 'book'
    for i, part in enumerate(parts):
        if part == 'raw' and i + 1 < len(parts):
            specialty = parts[i + 1]
        if part in ('books', 'articles', 'guidelines'):
            doc_type = part.rstrip('s')
    return specialty, doc_type

# Collect point IDs that need fixing
to_fix = defaultdict(list)  # (specialty, doc_type) -> [point_ids]
offset = None
scanned = 0

print('Scanning for null specialty...')
while True:
    try:
        batch, offset = qdrant.scroll(
            collection_name=COLLECTION, limit=500, offset=offset,
            with_payload=['specialty', 'document_type', 'path'],
        )
    except Exception as e:
        print(f'  Scroll error, retrying in 3s: {e}')
        time.sleep(3)
        continue

    if not batch:
        break
    scanned += len(batch)

    for pt in batch:
        sp = pt.payload.get('specialty')
        dt = pt.payload.get('document_type')
        if sp is not None and sp != 'unknown':
            continue
        path = pt.payload.get('path', '')
        new_sp, new_dt = infer_from_path(path)
        if new_sp is None:
            continue
        to_fix[(new_sp, new_dt)].append(pt.id)

    if scanned % 5000 == 0:
        print(f'  Scanned {scanned}, found {sum(len(v) for v in to_fix.values())} to fix')
    if offset is None:
        break

total_to_fix = sum(len(v) for v in to_fix.values())
print(f'\nScanned {scanned} points, {total_to_fix} need fixing in {len(to_fix)} groups')

# Apply fixes
fixed = 0
for (sp, dt), ids in sorted(to_fix.items()):
    for i in range(0, len(ids), 200):
        batch_ids = ids[i:i+200]
        retries = 3
        while retries > 0:
            try:
                qdrant.set_payload(
                    collection_name=COLLECTION,
                    payload={'specialty': sp, 'document_type': dt},
                    points=batch_ids,
                )
                break
            except Exception as e:
                retries -= 1
                print(f'  Error: {e}, retries left: {retries}')
                time.sleep(3)
        fixed += len(batch_ids)
        time.sleep(0.3)
    print(f'  Fixed {sp}/{dt}: {len(ids)} points')

print(f'\nDone. Fixed: {fixed}')
