"""
Normalize specialty capitalization and delete _duplicates from Qdrant.
Run: python fix_specialty_normalization.py
"""
import os
import time
from pathlib import Path
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

SPECIALTY_MAP = {
    'Abdome': 'abdome',
    'Geral': 'geral',
    'Neurorradiologia': 'neurorradiologia',
    'Torax': 'torax',
    'Pediatria': 'pediatria',
    'Mama': 'mama',
    'Musculo-esqueletico': 'msk',
    'Abdome|Torax|Geral': 'abdome',
}

def normalize_specialty(sp):
    return SPECIALTY_MAP.get(sp, sp)

print('=== Phase 1: Normalizing specialty capitalization ===')
offset = None
total_scanned = 0
total_fixed = 0
batch_size = 200

to_fix = {}
while True:
    try:
        batch, offset = qdrant.scroll(
            collection_name=COLLECTION, limit=500, offset=offset,
            with_payload=['specialty'],
        )
    except Exception as e:
        print(f'  Scroll error, retrying: {e}')
        time.sleep(3)
        continue

    if not batch:
        break
    total_scanned += len(batch)

    for pt in batch:
        sp = pt.payload.get('specialty', '')
        new_sp = normalize_specialty(sp)
        if sp != new_sp and new_sp != sp:
            key = (sp, new_sp)
            if key not in to_fix:
                to_fix[key] = []
            to_fix[key].append(pt.id)

    if offset is None:
        break

print(f'Scanned {total_scanned} chunks')
print(f'Found {len(to_fix)} specialty variations to fix')

for (old_sp, new_sp), ids in sorted(to_fix.items(), key=lambda x: -len(x[1])):
    print(f'  {old_sp} -> {new_sp}: {len(ids)} chunks')
    for i in range(0, len(ids), batch_size):
        batch_ids = ids[i:i+batch_size]
        retries = 3
        while retries > 0:
            try:
                qdrant.set_payload(
                    collection_name=COLLECTION,
                    payload={'specialty': new_sp},
                    points=batch_ids,
                )
                break
            except Exception as e:
                retries -= 1
                print(f'    Error: {e}, retries left: {retries}')
                time.sleep(3)
        total_fixed += len(batch_ids)
        time.sleep(0.3)
    print(f'  Fixed {len(ids)} chunks')

print(f'\nPhase 1 done. Fixed {total_fixed} chunks.')

print('\n=== Phase 2: Deleting _duplicates chunks ===')
offset = None
dupe_ids = []
scanned = 0

while True:
    try:
        batch, offset = qdrant.scroll(
            collection_name=COLLECTION, limit=500, offset=offset,
            with_payload=['specialty'],
        )
    except Exception as e:
        print(f'  Scroll error: {e}')
        time.sleep(3)
        continue

    if not batch:
        break
    scanned += len(batch)

    for pt in batch:
        if pt.payload.get('specialty') == '_duplicates':
            dupe_ids.append(pt.id)

    if offset is None:
        break

print(f'Found {len(dupe_ids)} _duplicates chunks to delete')

deleted = 0
for i in range(0, len(dupe_ids), batch_size):
    batch_ids = dupe_ids[i:i+batch_size]
    retries = 3
    while retries > 0:
        try:
            qdrant.delete(
                collection_name=COLLECTION,
                points_selector=batch_ids,
            )
            break
        except Exception as e:
            retries -= 1
            print(f'  Error deleting: {e}, retries left: {retries}')
            time.sleep(3)
    deleted += len(batch_ids)
    time.sleep(0.3)
    print(f'  Deleted batch {i//batch_size + 1}/{(len(dupe_ids)-1)//batch_size + 1} ({len(batch_ids)} chunks)')

print(f'\nPhase 2 done. Deleted {deleted} _duplicates chunks.')

print('\n=== Phase 3: Verifying final state ===')
from collections import Counter
offset = None
counts = Counter()
total = 0
while True:
    batch, offset = qdrant.scroll(collection_name=COLLECTION, limit=500, offset=offset, with_payload=['specialty'])
    if not batch:
        break
    total += len(batch)
    for pt in batch:
        counts[pt.payload.get('specialty', 'NULL')] += 1
    if offset is None:
        break

print(f'Total chunks: {total}')
for sp, c in counts.most_common():
    print(f'  {sp}: {c}')

print('\nDone!')
