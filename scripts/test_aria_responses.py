#!/usr/bin/env python3
"""Test ARIA chat endpoint with various questions across specialties."""
import json
import time
import urllib.request
import urllib.error
import ssl

API_URL = "https://aria-backend-production-176b.up.railway.app/chat"

# Disable SSL verification for testing
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

QUESTIONS = [
    # Mamografia
    {"q": "O que é BI-RADS e quais são suas categorias?", "specialty": None},
    # Neurorradiologia
    {"q": "Quais são os achados de imagem em um AVC isquêmico agudo na TC?", "specialty": None},
    # Abdome
    {"q": "Como aparece uma hepatite aguda na ultrassonografia?", "specialty": None},
    # Tórax
    {"q": "Quais são os sinais radiológicos de pneumotórax?", "specialty": None},
    # Pergunta sem resposta na base
    {"q": "Qual é a capital da França?", "specialty": None},
]

def ask(question, specialty=None, top_k=5):
    body = {"question": question, "top_k": top_k}
    if specialty:
        body["specialty"] = specialty
    
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        elapsed = time.time() - start
        return result, elapsed
    except Exception as e:
        return {"error": str(e)}, time.time() - start

print("=" * 70)
print("ARIA RAG Test Suite")
print("=" * 70)

for i, test in enumerate(QUESTIONS, 1):
    q = test["q"]
    print(f"\n{'-' * 70}")
    print(f"Test {i}: {q[:80]}...")
    print(f"{'-' * 70}")
    
    result, elapsed = ask(q, test.get("specialty"))
    
    if "error" in result:
        print(f"  [ERRO] {result['error']}")
        continue
    
    answer = result.get("answer", "")
    sources = result.get("sources", [])
    tokens = result.get("tokens_used", 0)
    
    # Check quality indicators
    has_sources = len(sources) > 0
    says_not_found = "não encontrei" in answer.lower() or "não foi possível" in answer.lower()
    has_citation = "Fonte:" in answer or "p." in answer
    
    src_flag = "OK" if has_sources else "SEM FONTES"
    cit_flag = "OK" if has_citation else "SEM CITACAO"
    rej_flag = "OK (rejeitou certo)" if says_not_found and i == 5 else ""
    
    print(f"  {elapsed:.1f}s | {tokens} tokens | {len(sources)} fontes | {src_flag} | {cit_flag} {rej_flag}")
    print(f"\n  Resposta: {answer[:500]}")
    if sources:
        print(f"\n  Fontes:")
        for s in sources[:3]:
            print(f"    - {s['title'][:60]} (p.{s.get('page_start','?')}) score={s['score']}")

print(f"\n{'=' * 70}")
print("Testes concluidos!")
