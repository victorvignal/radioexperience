#!/usr/bin/env python3
"""Hard questions round 2 - even more challenging radiology questions."""
import json, urllib.request, ssl, time
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

URL = "https://aria-backend-production-176b.up.railway.app/chat"

QUESTIONS = [
    # 1. Caso clinico complexo - TI-RADS com achados mistos
    {"q": "Nodulo tireoidiano 3cm, solidocistico, hiperecoico, com calcificacao grosseira e margem ligeramente lobulada. Qual a classificacao TI-RADS?", "label": "TI-RADS complexo"},
    
    # 2. Diagnostico diferencial com pouca informacao
    {"q": "TC de abdome mostra lesao hipodensa no figado com realce periferico em fase portal e washout tardio. Qual o diagnostico mais provavel?", "label": "Lesao hepatica TC"},
    
    # 3. Sinal radiologico pouco conhecido
    {"q": "O que e o sinal da montanha russa (coaster sign) na radiografia de torax?", "label": "Sinal raro"},
    
    # 4. Caso de urgencia
    {"q": "Paciente politraumatizado, radiografia de torax mostra alargamento do mediastino, fratura de primeiras costelas e desvio traqueal. Qual a suspeita diagnostica e qual o exame de confirmacao?", "label": "Trauma toracico"},
    
    # 5. BI-RADS com descricao detalhada
    {"q": "Mamografia mostra uma opacidade espiculada de 15mm, com distorcao arquitetural associada e microcalcificacoes agrupadas pleomorficas no quadrante superolateral esquerdo. Classifique BI-RADS.", "label": "BI-RADS complexo"},
    
    # 6. Patologia rara
    {"q": "Quais sao os achados de imagem da calcinose tumoral na radiografia simples?", "label": "Patologia rara"},
    
    # 7. Tecnica de exame
    {"q": "Qual a diferenca entre angioTC e angiografia por cateter no diagnostico de tromboembolismo pulmonar?", "label": "Tecnica de exame"},
    
    # 8. Pediatrico
    {"q": "Quais sao os achados radiologicos da intususcepcao intestinal em criancas e qual o papel da reducao hidrostatica?", "label": "Pediatrico"},
    
    # 9. Neuro - caso complexo
    {"q": "RM de cranio mostra lesao expansiva intrassellara com realce homogeneo apos gadolinio, desvio do infundibulo hipofisario e erosao do dorso da sela turcica. Qual o diagnostico provavel?", "label": "Neuro complexo"},
    
    # 10. Conceito fisico
    {"q": "Explique a diferenca entre resolucao espacial e resolucao de contraste na imagem por TC.", "label": "Fisica medica"},
]

def ask(q):
    body = json.dumps({"question": q, "top_k": 10}).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=90, context=ctx) as resp:
            r = json.loads(resp.read().decode("utf-8"))
        return r, time.time() - start
    except Exception as e:
        return {"error": str(e)}, time.time() - start

print("=" * 70)
print("ARIA HARD QUESTIONS - ROUND 2")
print("=" * 70)

results = []
for i, t in enumerate(QUESTIONS, 1):
    q = t["q"]
    label = t["label"]
    print(f"\n{'-'*70}")
    print(f"Q{i} [{label}]: {q[:80]}...")
    
    r, elapsed = ask(q)
    
    if "error" in r:
        print(f"  ERRO: {r['error']}")
        results.append((i, label, 0, 0, False, "ERRO"))
        continue
    
    answer = r.get("answer", "")
    sources = r.get("sources", [])
    tokens = r.get("tokens_used", 0)
    avg_score = sum(s["score"] for s in sources) / len(sources) if sources else 0
    has_cite = "Fonte:" in answer or "fonte:" in answer.lower()
    rejected = "nao encontrei" in answer.lower()
    
    status = "OK" if (has_cite and not rejected) else ("REJEITADO" if rejected else "SEM CITE")
    results.append((i, label, len(sources), avg_score, has_cite, status))
    
    print(f"  {elapsed:.1f}s | {tokens}tok | {len(sources)}fontes | score={avg_score:.3f} | {status}")
    print(f"  -> {answer[:400]}")
    if sources:
        print(f"  Fontes: {sources[0]['title'][:50]} (p.{sources[0].get('page_start','?')})")

print(f"\n{'='*70}")
print("RESUMO FINAL")
print(f"{'='*70}")
ok = sum(1 for r in results if r[5] == "OK")
print(f"OK: {ok}/10")
print(f"\n{'Q#':<4} {'Label':<20} {'Fontes':<8} {'Score':<8} {'Cite':<6} {'Status'}")
print("-" * 56)
for i, label, ns, sc, cite, status in results:
    print(f"Q{i:<3} {label:<20} {ns:<8} {sc:<8.3f} {'SIM' if cite else 'NAO':<6} {status}")
