"""
Teste de carga: 50 perguntas de radiologia variadas
Áreas: mama, tórax, neurorradiologia, abdome, musculoesquelético, vascular, pediatria, urgência
Dificuldades: básica, intermediária, avançada
"""
import httpx
import json
import time
from datetime import datetime

API_URL = "https://aria-backend-production-176b.up.railway.app/chat"

PERGUNTAS = [
    # --- BÁSICA (10) ---
    ("básica", "mama", "O que é BI-RADS?"),
    ("básica", "tórax", "O que é consolidação pulmonar?"),
    ("básica", "musculoesquelético", "O que é fratura em galho verde?"),
    ("básica", "neurorradiologia", "O que é edema cerebral?"),
    ("básica", "abdome", "O que é hepatomegalia?"),
    ("básica", "tórax", "Quais são os lobos pulmonares direita?"),
    ("básica", "mama", "O que é calcificação na mamografia?"),
    ("básica", "vascular", "O que é aneurisma de aorta abdominal?"),
    ("básica", "musculoesquelético", "Qual a diferença entre luxação e subluxação?"),
    ("básica", "tórax", "O que é derrame pleural?"),

    # --- INTERMEDIÁRIA (20) ---
    ("intermediária", "mama", "Qual a diferença entre BIRADS 3 e BIRADS 4?"),
    ("intermediária", "tórax", "Como diferenciar consolidação de derrame pleural no raio-x?"),
    ("intermediária", "neurorradiologia", "Quais os critérios de McDonald para esclerose múltipla?"),
    ("intermediária", "musculoesquelético", "Qual a apresentação radiológica da doença de Perthes?"),
    ("intermediária", "abdome", "Como stratificar risco de apendicite pelo escore de Alvarado?"),
    ("intermediária", "mama", "Quando usar ultrassom complementar à mamografia?"),
    ("intermediária", "tórax", "Quais achados radiológicos sugerem insuficiência cardíaca esquerda?"),
    ("intermediária", "neurorradiologia", "Qual a diferença entre AVC isquêmico e hemorrágico na TC?"),
    ("intermediária", "vascular", "Quando pedir angio-TC de artérias renais?"),
    ("intermediária", "musculoesquelético", "Quais são os estágios de Ficat para necrose avascular da femoral?"),
    ("intermediária", "abdome", "Qual a sensibilidade da ultrassonografia para litíase biliar?"),
    ("intermediária", "mama", "Como funciona a classificação TNM para câncer de mama?"),
    ("intermediária", "tórax", "O que é sinal do halo invertido na tuberculose?"),
    ("intermediária", "neurorradiologia", "Quando pedir RNM de sela túrcica?"),
    ("intermediária", "musculoesquelético", "Qual a utilidade da radiografia na suspeita de osteomielite?"),
    ("intermediária", "abdome", "Quais achados de TC sugerem pancreatite necrosante?"),
    ("intermediária", "tórax", "Como stratificar nódulo pulmonar pelo sistema Lung-RADS?"),
    ("intermediária", "vascular", "Qual o papel do Doppler venoso no diagnóstico de TVP?"),
    ("intermediária", "musculoesquelético", "O que é sinal de Blinese?"),
    ("intermediária", "neurorradiologia", "Quais são os subtipos de glioma pela classificação WHO 2021?"),

    # --- AVANÇADA (20) ---
    ("avançada", "mama", "Qual o valor preditivo positivo real do BIRADS 4A na prática brasileira?"),
    ("avançada", "neurorradiologia", "Como o protocolo de Stroke do ACC/AHA muda a conduta no AVC agudo?"),
    ("avançada", "musculoesquelético", "Quais critérios de督teinberg classificam necrose avascular da femoral?"),
    ("avançada", "tórax", "Qual a acurácia do PET-CT no estadiamento do carcinoma brônquico não pequenas células?"),
    ("avançada", "abdome", "Quando a ressonância magnética com hepatobiliares substitui a colangio-Wirsung?"),
    ("avançada", "mama", "Qual a taxa de upgrade de lesãocistadenocarcinoma mucinoso no BIRADS 5?"),
    ("avançada", "neurorradiologia", "Quais os novos biomarcadores de imagem no diagnóstico de Alzheimer?"),
    ("avançada", "vascular", "Qual a mortalidade operatória do AAA roto vs eletivo?"),
    ("avançada", "musculoesquelético", "Como o ângulo alfa do fêmur prediz colapso na doença de Perthes?"),
    ("avançada", "tórax", "Quais são os padrões de perfusão no cintilograma V/Q e sua interpretação?"),
    ("avançada", "abdome", "Qual a sensibilidade e especificidade da elastografia na fibrose hepática?"),
    ("avançada", "neurorradiologia", "Como o Swallow Tail Sign exclui Parkinson?"),
    ("avançada", "mama", "Qual o papel doSono nel contesto del BIRADS 3?"),
    ("avançada", "vascular", "Quando indicar endarterectomia vs angioplastia na doença carotídea?"),
    ("avançada", "musculoesquelético", "Qual a utilidade doângulo de rebatimento na displasia do desenvolvimento do quadril?"),
    ("avançada", "tórax", "Como os critérios deFleischner 2023 mudaram o follow-up de nódulos incidentais?"),
    ("avançada", "abdome", "Qual a acurácia da RM multiparamétrica da próstata na detecção de Gleason ≥7?"),
    ("avançada", "neurorradiologia", "Quais achados de imagem distinguem neuromielite óptica de esclerose múltipla?"),
    ("avançada", "mama", "Como incorporar inteligência artificial na leitura mamográfica?"),
    ("avançada", "vascular", "Qual o algoritmo de tratamento para dissecção aórtica tipo B de Stanford?"),
]

def send_question(q: str) -> dict:
    try:
        resp = httpx.post(API_URL, json={"question": q, "top_k": 5}, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        return {"status": "ok", "answer": data.get("answer", "")[:300], "sources": len(data.get("sources", []))}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def main():
    results = []
    start = time.time()

    print(f"🚀 Iniciando teste — {len(PERGUNTAS)} perguntas — {datetime.now():%H:%M:%S}\n")

    for i, (dificuldade, especialidade, pergunta) in enumerate(PERGUNTAS, 1):
        print(f"[{i:02d}/50] {dificuldade.upper():16s} | {especialidade:22s} | {pergunta[:60]}", end=" ... ", flush=True)
        r = send_question(pergunta)
        if r["status"] == "ok":
            print(f"✅ ({r['sources']} fontes, {len(r['answer'])} chars)")
            results.append({"n": i, "dificuldade": dificuldade, "especialidade": especialidade, "pergunta": pergunta, **r})
        else:
            print(f"❌ {r['error']}")
            results.append({"n": i, "dificuldade": dificuldade, "especialidade": especialidade, "pergunta": pergunta, "status": "error", "error": r["error"]})
        time.sleep(0.5)  # evitar rate limit

    elapsed = time.time() - start

    # resumo
    ok = sum(1 for r in results if r["status"] == "ok")
    err = len(results) - ok
    print(f"\n\n📊 RESUMO — {elapsed:.0f}s total")
    print(f"   OK: {ok}/50 | Erros: {err}/50")

    # por dificuldade
    for diff in ["básica", "intermediária", "avançada"]:
        subset = [r for r in results if r.get("dificuldade") == diff]
        ok_diff = sum(1 for r in subset if r["status"] == "ok")
        print(f"   {diff.upper():16s}: {ok_diff}/{len(subset)} OK")

    # por especialidade
    print("\n   Por especialidade:")
    for esp in sorted(set(r["especialidade"] for r in results)):
        subset = [r for r in results if r.get("especialidade") == esp]
        ok_esp = sum(1 for r in subset if r["status"] == "ok")
        print(f"   {esp.upper():22s}: {ok_esp}/{len(subset)} OK")

    # salvar
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    with open(f"aria_50_perguntas_{ts}.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Resultados salvos em aria_50_perguntas_{ts}.json")

if __name__ == "__main__":
    main()
