#!/usr/bin/env python3
"""Re-test Q7 and Q8 after fix."""
import json, urllib.request, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

questions = {
    "Q7": "Paciente com dispneia aguda, radiografia de torax mostra opacificacao hemitorax direito com desvio mediastinal para esquerda. Qual o diagnostico mais provavel e quais outras hipoteses?",
    "Q8": "O que e o sinal do sulco profundo na radiografia de torax e em que patologia e classicamente visto?",
}

for qid, q in questions.items():
    body = json.dumps({"question": q, "top_k": 7}).encode("utf-8")
    req = urllib.request.Request(
        "https://aria-backend-production-176b.up.railway.app/chat",
        data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        answer = result["answer"]
        sources = result["sources"]
        has_cite = "Fonte:" in answer
        print(f"\n{'='*60}")
        print(f"{qid} | fontes={len(sources)} | citacao={'SIM' if has_cite else 'NAO'}")
        print(f"{'='*60}")
        print(answer[:800])
        print(f"\nFontes top:")
        for s in sources[:3]:
            print(f"  {s['title'][:50]} (p.{s.get('page_start','?')}) score={s['score']}")
    except Exception as e:
        print(f"{qid} ERRO: {e}")
