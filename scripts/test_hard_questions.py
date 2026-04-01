import json
import ssl
import urllib.request

URL = "https://aria-backend-production-176b.up.railway.app/chat"

questions = [
    "Paciente de 45 anos com nodulo tireoidiano de 2cm, solido, isoecoico, com margens microlobuladas e microcalcificacoes. Qual a classificacao TI-RADS e qual a conduta recomendada?",
    "Quais sao os criterios ultrassonograficos de malignidade de nodulos mamarios segundo o BI-RADS?",
    "Descreva os achados de imagem de um glioblastoma multiforme na ressonancia magnetica com contraste.",
    "Qual a diferenca entre um abscesso hepatico e uma metastase na tomografia computadorizada com contraste?",
    "Quais sao os sinais de alca presa na radiografia simples de abdome?",
    "Descreva o padrao de realce de um hemangioma hepatico tipico na TC multifasica.",
    "Paciente com dispneia aguda, radiografia de torax mostra opacificacao hemitorax direito com desvio mediastinal para esquerda. Qual o diagnostico mais provavel e quais outras hipoteses?",
    "O que e o sinal do sulco profundo na radiografia de torax e em que patologia e classicamente visto?",
    "Quais sao as caracteristicas de imagem de uma fratura por estresse na ressonancia magnetica?",
    "Paciente com dor abdominal aguda, TC mostra dilatacao de alcas de delgado com nivel hidroaereo e ausencia de realce da parede intestinal. Qual o diagnostico e qual o sinal de gravidade?",
]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

results = []

for i, q in enumerate(questions, start=1):
    payload = json.dumps({"question": q, "top_k": 5}).encode("utf-8")
    req = urllib.request.Request(URL, data=payload, headers={"Content-Type": "application/json"})
    print(f"Q{i} [INFO] sending", flush=True)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        body = json.dumps({"error": str(e)})

    try:
        data = json.loads(body)
    except Exception:
        data = {"raw": body}

    answer = data.get("answer") or data.get("response") or data.get("raw") or ""
    sources = data.get("sources") or []
    num_sources = len(sources) if isinstance(sources, list) else 0
    top_score = None
    if isinstance(sources, list) and sources:
        s0 = sources[0]
        if isinstance(s0, dict):
            top_score = s0.get("score") or s0.get("similarity") or s0.get("relevance")
    has_citations = "[Fonte:" in answer

    ans_short = answer[:400].replace("\n", " ").replace("\r", " ")
    ans_short = ans_short.encode("ascii", "replace").decode("ascii")
    status = "[OK]"
    if not has_citations and num_sources > 0:
        status = "[WARN]"
    if num_sources == 0:
        status = "[FAIL]"
    print(f"Q{i} {status} Answer: {ans_short}")
    top_score_str = str(top_score).encode("ascii", "replace").decode("ascii")
    print(f"Q{i} Sources: {num_sources} TopScore: {top_score_str} Citations: {has_citations}")
    print("-")

    rejected = False
    if isinstance(data, dict):
        rejected = bool(data.get("rejected") or data.get("error"))

    results.append({
        "q": i,
        "score": top_score,
        "has_sources": num_sources > 0,
        "has_citations": has_citations,
        "rejected": rejected,
    })

print("Summary")
print("Q# | Score | HasSources | HasCitations | Rejected | Status")
for r in results:
    q = r["q"]
    score = r["score"]
    hs = r["has_sources"]
    hc = r["has_citations"]
    rej = r["rejected"]
    status = "[OK]"
    if not hc and hs:
        status = "[WARN]"
    if not hs:
        status = "[FAIL]"
    score_str = str(score).encode("ascii", "replace").decode("ascii")
    print(f"{q} | {score_str} | {hs} | {hc} | {rej} | {status}")
