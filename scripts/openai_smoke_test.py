import os
from openai import OpenAI


def main():
    api_key = os.getenv('OPENAI_API_KEY')
    model = os.getenv('OPENAI_EMBED_MODEL', 'text-embedding-3-small')
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY não definido')
    client = OpenAI(api_key=api_key)
    resp = client.embeddings.create(model=model, input=['teste radiologia mama'])
    print({'model': model, 'embedding_dim': len(resp.data[0].embedding)})


if __name__ == '__main__':
    main()
