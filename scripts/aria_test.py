import json
import ssl
import urllib.request
import os
import socket

os.environ['PYTHONIOENCODING'] = 'utf-8'

URL = 'https://aria-backend-production-176b.up.railway.app/chat'

questions = [
    (1, "O que e uma fistula arteriovenosa coronaria e quais sao seus achados de imagem?"),
    (2, "Descreva a trombose in-situ da arteria pulmonar na tomografia."),
    (3, "Quais sao os achados de imagem da luxacao posterior do quadril?"),
    (4, "O que e o leiomioma parasitario?"),
    (5, "Quais sao as manifestacoes radiologicas da doenca de Sjogren?"),
    (6, "Descreva os achados de imagem da doenca celiaca no transito intestinal."),
    (7, "Quais sao os achados do dreno ventricular externo na radiografia de cranio?"),
    (8, "O que sao os tumores cardiacos malignos secundarios e como aparecem na imagem?"),
    (9, "barriga"),
    (10, "quadril"),
    (11, "e normal?"),
    (12, "tipo assim aquela coisa do pulmao"),
    (13, "celiaca"),
    (14, "meu exame deu ruim"),
    (15, "sindrome de sjogren o que e"),
    (16, "trombose pulmao"),
]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

socket.setdefaulttimeout(20)

def post_question(q):
    data = json.dumps({"question": q, "top_k": 10}).encode('utf-8')
    req = urllib.request.Request(URL, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
        raw = resp.read().decode('utf-8', errors='replace')
        return raw

results = []

for qnum, qtext in questions:
    try:
        raw = post_question(qtext)
        try:
            js = json.loads(raw)
        except Exception:
            js = {"_raw": raw}
        results.append((qnum, qtext, js))
    except Exception as e:
        results.append((qnum, qtext, {"error": str(e)}))

out_path = r"C:\Users\vigna\.openclaw\workspace\radioexperience\scripts\aria_test_results.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=True, indent=2)

print(out_path)
