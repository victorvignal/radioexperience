import requests

r = requests.post('https://aria-backend-production-176b.up.railway.app/chat', json={
    'question': 'Me ajude. Paciente veio fazer TC de abdome. Apos a injecao do contraste apresentou bradicardia. Que tipo de reacao alergica e essa e qual o tratamento devo fazer?',
    'top_k': 5
})
data = r.json()
print(data['answer'][:1000])
print('...')
print(f"Sources: {len(data['sources'])}")
