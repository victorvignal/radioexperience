import os
from qdrant_client import QdrantClient


def main():
    url = os.getenv('QDRANT_URL')
    api_key = os.getenv('QDRANT_API_KEY')
    collection = os.getenv('QDRANT_COLLECTION', 'radioexperience_knowledge')
    if not url:
        raise RuntimeError('QDRANT_URL não definido')
    client = QdrantClient(url=url, api_key=api_key)
    collections = [c.name for c in client.get_collections().collections]
    print({'collections': collections, 'target_exists': collection in collections})
    if collection in collections:
        print(client.get_collection(collection))


if __name__ == '__main__':
    main()
