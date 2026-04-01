"""
Remove _duplicates specialty chunks from Qdrant collection.
Also optionally removes None/unset specialty chunks (with --include-none flag).

Usage:
  python cleanup_qdrant.py              # remove only _duplicates
  python cleanup_qdrant.py --dry-run    # show what would be removed
  python cleanup_qdrant.py --include-none  # also remove unset specialty
"""
import os
import argparse
import time
from pathlib import Path
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, IsEmptyCondition

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

qdrant = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY"),
    timeout=60
)
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")


def count_by_filter(qdrant, collection, payload_filter):
    """Count points by scrolling (no index required)."""
    count = 0
    offset = None
    while True:
        result, offset = qdrant.scroll(
            collection_name=collection,
            limit=500,
            offset=offset,
            with_payload=False,
            with_vectors=False,
        )
        if not result:
            break
        # Manual filter check
        for pt in result:
            count += 1  # placeholder — actual filtering done client-side below
    return count


def find_points_by_specialty(qdrant, collection, specialty_value=None, is_none=False):
    """Find point IDs matching specialty filter. Scrolls and filters client-side."""
    ids = []
    offset = None
    scanned = 0
    while True:
        result, offset = qdrant.scroll(
            collection_name=collection,
            limit=500,
            offset=offset,
            with_payload=['specialty'],
            with_vectors=False,
        )
        if not result:
            break
        scanned += len(result)
        for pt in result:
            sp = pt.payload.get('specialty')
            if is_none and sp is None:
                ids.append(pt.id)
            elif specialty_value and sp == specialty_value:
                ids.append(pt.id)
        if scanned % 5000 == 0:
            print(f"  Scanned {scanned}, found {len(ids)} matching...")
        if offset is None:
            break
    return ids


def delete_points(qdrant, collection, point_ids, batch_size=200):
    """Delete points in batches."""
    deleted = 0
    for i in range(0, len(point_ids), batch_size):
        batch = point_ids[i:i + batch_size]
        retries = 3
        while retries > 0:
            try:
                qdrant.delete(
                    collection_name=collection,
                    points_selector=batch,
                )
                break
            except Exception as e:
                retries -= 1
                print(f"  Error deleting batch: {e}, retries left: {retries}")
                time.sleep(3)
        deleted += len(batch)
        time.sleep(0.2)
        if deleted % 1000 == 0:
            print(f"  Deleted {deleted}/{len(point_ids)}...")
    return deleted


def main():
    parser = argparse.ArgumentParser(description="Clean up Qdrant collection")
    parser.add_argument('--dry-run', action='store_true', help='Show counts without deleting')
    parser.add_argument('--include-none', action='store_true', help='Also remove unset specialty')
    args = parser.parse_args()

    total = qdrant.count(collection_name=COLLECTION).count
    print(f"Collection: {COLLECTION}")
    print(f"Total chunks: {total}")

    # Find _duplicates
    print(f"\nScanning for _duplicates...")
    dup_ids = find_points_by_specialty(qdrant, COLLECTION, specialty_value='_duplicates')
    print(f"  _duplicates: {len(dup_ids)}")

    # Find None specialty
    none_ids = []
    if args.include_none:
        print(f"\nScanning for unset specialty...")
        none_ids = find_points_by_specialty(qdrant, COLLECTION, is_none=True)
        print(f"  Unset specialty: {len(none_ids)}")

    total_remove = len(dup_ids) + len(none_ids)
    print(f"\n{'='*50}")
    print(f"Would remove: {total_remove} chunks ({len(dup_ids)} duplicates + {len(none_ids)} unset)")
    print(f"After cleanup: {total - total_remove} chunks")

    if args.dry_run:
        print(f"\nDry run — nothing deleted. Use without --dry-run to apply.")
        return

    if total_remove == 0:
        print(f"\nNothing to remove. Collection is clean.")
        return

    confirm = input(f"\nDelete {total_remove} points? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print("Aborted.")
        return

    if dup_ids:
        print(f"\nDeleting {len(dup_ids)} _duplicates...")
        deleted = delete_points(qdrant, COLLECTION, dup_ids)
        print(f"  Done: {deleted} deleted")

    if none_ids:
        print(f"\nDeleting {len(none_ids)} unset specialty...")
        deleted = delete_points(qdrant, COLLECTION, none_ids)
        print(f"  Done: {deleted} deleted")

    final = qdrant.count(collection_name=COLLECTION).count
    print(f"\nFinal count: {final} chunks (was {total})")


if __name__ == '__main__':
    main()
