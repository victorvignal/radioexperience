#!/usr/bin/env python3
"""Test ARIA with poorly formulated questions."""
import json
import time
import urllib.request
import ssl

API_URL = "https://aria-backend-production-176b.up.railway.app/chat"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

QUESTIONS = [
    # Vagas / sem contexto
    {"q": "mama", "label": "Palavra solta: 'mama'"},
    {"q": "dor", "label": "Palavra solta: 'dor'"},
    {"q": "imagem", "label": "Palavra solta: 'imagem'"},
    
    # Perguntas confusas
    {"q": "tipo assim sabe aquela coisa do osso que aparece la", "label": "Gagueira/confuso"},
    {"q": "b irads", "label": "Erro de digitação: 'b irads'"},
    {"q": "birads 4 oq fazer", "label": "Informal/abreviado"},
    
    # Pergunta ambígua
    {"q": "isso é grave?", "label": "Sem contexto: 'isso é grave?'"},
    {"q": "tá normal?", "label": "Sem contexto: 'tá normal?'"},
    
    # Misto (pergunta + contexto útil)
    {"q": "meu médico pediu uma mamografia e deu birads 3 o que significa", "label": "Informal mas com contexto"},
]

def ask(question, top_k=5):
    body = json.dumps({"question": question, "top_k": top_k}).encode("utf-8")
    req = urllib.request.Request(API_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result, time.time() - start
    except Exception as e:
        return {"error": str(e)}, time.time() - start

print("=" * 70)
print("ARIA - Teste de perguntas mal formuladas")
print("=" * 70)

for i, test in enumerate(QUESTIONS, 1):
    q = test["q"]
    label = test["label"]
    print(f"\n{'-' * 70}")
    print(f"Test {i}: [{label}]")
    print(f'  Pergunta: "{q}"')
    print(f"{'-' * 70}")
    
    result, elapsed = ask(q)
    
    if "error" in result:
        print(f"  [ERRO] {result['error']}")
        continue
    
    answer = result.get("answer", "")
    sources = result.get("sources", [])
    tokens = result.get("tokens_used", 0)
    avg_score = sum(s["score"] for s in sources) / len(sources) if sources else 0
    
    says_not_found = "nao encontrei" in answer.lower() or "nao foi possivel" in answer.lower()
    
    print(f"  {elapsed:.1f}s | {tokens} tok | {len(sources)} fontes | score medio: {avg_score:.3f}")
    print(f"  Respondeu: {'REJEITOU (nao encontrou)' if says_not_found else 'GEROU RESPOSTA'}")
    print(f"  -> {answer[:300]}")

print(f"\n{'=' * 70}")
print("Conclusao: perguntas vagas devem ser REJEITADAS (nao encontrou)")
print("Perguntas informais mas com contexto devem ser RESPONDIDAS")
