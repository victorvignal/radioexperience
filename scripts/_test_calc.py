import requests

r = requests.post('https://aria-backend-production-176b.up.railway.app/chat', json={
    'question': 'Quais sao os tipos de calcificacoes na mamografia e seu percentual de malignidade?',
    'top_k': 10
})
data = r.json()
print(data['answer'][:1500])
print('...')
print(f"Sources: {len(data['sources'])}")
