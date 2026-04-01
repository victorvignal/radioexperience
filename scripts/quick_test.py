#!/usr/bin/env python3
import json, urllib.request, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
body = json.dumps({"question":"Qual a classificação TIRADS de um nódulo sólido, hipoecoico, mais largo do que alto, com margem definida e sem calcificações","top_k":5}).encode("utf-8")
req = urllib.request.Request("https://aria-backend-production-176b.up.railway.app/chat",data=body,headers={"Content-Type":"application/json"},method="POST")
with urllib.request.urlopen(req,timeout=60,context=ctx) as resp:
    result = json.loads(resp.read().decode("utf-8"))
print("RESPOSTA:")
print(result["answer"][:1000])
