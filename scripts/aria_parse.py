import json
import re

path = r"C:\Users\vigna\.openclaw\workspace\radioexperience\scripts\aria_test_results.json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)


def to_ascii(s):
    return s.encode('ascii', errors='ignore').decode('ascii')

for qnum, qtext, js in data:
    answer = js.get('answer','') if isinstance(js, dict) else ''
    ans300 = answer[:300]
    sources = js.get('sources', []) if isinstance(js, dict) else []
    top_score = None
    if sources:
        top_score = max(s.get('score',0) for s in sources)
    num_sources = len(sources)
    rejected = 'no'
    if 'nao encontrei informacoes suficientes' in answer.lower() or 'sua pergunta e muito generica' in answer.lower() or 'tente reformular' in answer.lower():
        rejected = 'yes'
    has_citations = 'yes' if num_sources>0 else 'no'
    line = f"{qnum} {ans300.replace('\n',' ')} {num_sources} {top_score} {rejected} {has_citations}"
    print(to_ascii(line))
