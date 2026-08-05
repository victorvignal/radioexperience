# Thermo-Nuclear Code Quality Review — RadioeXperience

> Skill aplicada: [`thermo-nuclear-code-quality-review`](https://github.com/Oreo992/skills/blob/main/skills/thermo-nuclear-code-quality-review/SKILL.md)
> Repositório: `victorvignal/radioexperience`
> Branch: `main` (commit `8084b34`)
> Data: 2026-08-04
> Escopo lido: `backend/main.py` (inteiro, 3020 linhas), `web/src/App.jsx` (inteiro, 620 linhas), `web/src/pages/AriaPage.jsx` (120 linhas), `web/src/pages/ChallengePage.jsx` (971 linhas), `web/src/pages/Dashboard.jsx` + `Create.jsx` + `AdminUsers.jsx` (não lidos, só `wc -l`), `web/src/contexts/AuthContext.jsx` (inteiro, 180 linhas), `sql/*.sql` (inteiros), scripts mapeados por nome.

## Approval Bar — Verdict: REQUEST CHANGES (parcial — issues #1, #2, #3 e #10 deferidos)

Não recomendo merge sem antes decompor os pontos #1 e #2 abaixo. O resto é incremental.

**Atualização 2026-08-04:** por decisão do dono do repo (trade-off de risco vs ganho), os pontos **#1 (decompor main.py em routers)**, **#2 (extrair supabase_client.py)**, **#3 (unificar models Pydantic)** e **#10 (batch insert no challenge_start)** foram **deferidos para uma janela futura** quando o projeto passar por mudanças grandes. O custo de regressão durante refactor estrutural foi julgado maior que o ganho de manutenibilidade no momento atual. Os fixes **#4, #5, #6, #8 e #9 foram aplicados** (ver commit history).

---

## 1. ESTRUTURAL — `backend/main.py` está em 3020 linhas, **3x acima do limite de 1k**

**Localização:** `backend/main.py` inteiro
**Severidade:** bloqueante presumptivo

A regra #1 da skill diz: **"Do not let a PR push a file from under 1k lines to over 1k lines without a very strong reason."** Este arquivo está em **3020 linhas** com **31 endpoints** num único módulo FastAPI. Não é só "passou do limite", passou **3x**.

Ironicamente, a skill aceita waiver se houver "compelling structural reason". Não há. Os 31 endpoints se dividem em **6 domínios** claramente identificáveis, cada um com seus próprios schemas Pydantic, helpers, system prompts e tabelas Supabase. Não há razão técnica pra estarem juntos.

### Code judo move óbvio

Extrair para um package `backend/routers/` com um arquivo por domínio:

| Arquivo novo | Endpoints | LOC estimado |
|---|---|---|
| `backend/routers/chat.py` | `/chat`, `/chat/stream`, `/chat/edit`, `/chat-sessions/*`, `/chat-messages/*` | ~800 |
| `backend/routers/challenge.py` | `/challenge/*` (start, answer, finish, leaderboard, history, debug-insert) | ~500 |
| `backend/routers/studylab.py` | `/criar/{template_type}` + `CRIAR_PROMPTS` | ~400 |
| `backend/routers/shifts.py` | `/upload-shifts`, `/shifts/*`, `/shifts/batches` | ~300 |
| `backend/routers/feed.py` | `/feed/*`, `/posts/*` | ~200 |
| `backend/routers/health.py` | `/health`, `/specialties` | ~80 |
| `backend/main.py` | só lifespan, CORS, rate limiter, app setup | ~80 |

**Efeito:** nenhum arquivo passa de 800 linhas. O `main.py` vira só o entrypoint com 80 linhas. Cada router pode ser testado e modificado isoladamente.

### Por que isso importa agora (não é cosmético)

- **JWT decode sem verificação de assinatura** está em `verify_supabase_token` (linha 255). Misturado com 3000 linhas de RAG/shifts/feed, fica difícil auditar.
- **System prompt ARIA inline** (linhas 377-459, 80+ linhas) misturado com lógica de chat. Devia estar em `prompts/SYSTEM_PROMPT_ARIA.txt`.
- **Mudanças em uma área** (ex: schema de shifts) obrigam ler o arquivo inteiro pra garantir que nada quebra.

---

## 2. SPAGHETTI — Helpers de Supabase copiados em 7 endpoints diferentes

**Localização:** `backend/main.py:660, 686, 715, 750, 778, 805, 833` (mínimo)
**Severidade:** bloqueante presumptivo

O mesmo bloco de código aparece em **pelo menos 7 endpoints** relacionados a shifts:

```python
supabase_url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not supabase_key:
    raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY não configurada")
headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json",
}
```

A skill é explícita: **"Do not be satisfied with merely cleaner version of the same messy idea if there is a plausible path to a much simpler idea"** e **"Bespoke helpers where the codebase already has a canonical utility for the job"**.

### Code judo move óbvio

Extrair para um helper canônico. Já existe um `_supabase_headers()` (linha 1434) usado em **outros 5 endpoints** (challenge, feed, posts). Mas esse helper existe **duas vezes no arquivo** — o segundo bloco é o `_supabase_headers()` completo:

```python
# backend/main.py:1431-1439 (helper real, usado em challenge/feed/posts)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")

def _supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
```

E **mesmo assim** os endpoints de shifts (linhas 660, 686, 715, ...) ignoram esse helper e **redeclaram inline**.

### Refatoração sugerida

Criar `backend/supabase_client.py`:

```python
from functools import lru_cache
import os
from fastapi import HTTPException

@lru_cache(maxsize=1)
def supabase_config():
    url = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY não configurada")
    return url, key

def supabase_headers(extra: dict | None = None) -> dict:
    _, key = supabase_config()
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h
```

Os 7 endpoints de shifts perdem 10-15 linhas cada. Total: ~100 linhas deletadas, zero ambiguidade.

**Bonus**: hoje os endpoints de shifts usam `or os.getenv("SUPABASE_SERVICE_ROLE_KEY")` enquanto o helper canônico usa `or os.getenv("SUPABASE_ANON_KEY")` como fallback. **Inconsistência que pode dar bypass de RLS** se cair no `ANON_KEY` por typo na env.

---

## 3. TYPE CLEANLINESS — ChatRequest valida 4KB image_base64 mas `image_b64` em chat-messages aceita 10MB

**Localização:** `backend/main.py:353` vs `backend/main.py:2922`
**Severidade:** warning

```python
# main.py:353
image_base64: str | None = Field(default=None, max_length=10_000_000)  # ~10MB max

# main.py:2922
image_b64: str | None = Field(default=None, max_length=10_000_000)
```

OK, são até iguais. Mas a inconsistência está em **outro lugar**. O `ChatRequest` valida `top_k` com `ge=1, le=20`, mas em `chat/edit` (linha 1235) usa `top_k: int = 6` sem validator. **Mesma intenção, contratos diferentes**.

A skill: **"Push hard on type and boundary cleanliness when they affect maintainability"** e **"Question unnecessary optionality"**.

### Refatoração sugerida

Mover os modelos para `backend/models.py`:

```python
class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    question: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=10, ge=1, le=20)  # canônico
    specialty: str | None = Field(default=None, max_length=100)
    image_base64: str | None = Field(default=None, max_length=10_000_000)
```

E `ChatEditRequest` herdar ou reusar. Hoje há **3 definições diferentes de "request com question e top_k"** no arquivo.

---

## 4. SPAGHETTI — `_is_trivial_greeting` tem lógica inalcançável

**Localização:** `backend/main.py:222-236`
**Severidade:** warning

```python
def _is_trivial_greeting(q: str) -> bool:
    normalized = q.lower().strip().rstrip('!').rstrip('?')
    trivial_greetings = {"oi", "ola", ...}
    return (
        normalized in trivial_greetings
        or (len(normalized) <= 3 and not any(c.isalnum() for c in normalized) is False)  # ← ???
        or (len(normalized) <= 2 and normalized in "oi oi oi olláhi hey".split())
    )
```

A condição `len(normalized) <= 3 and not any(c.isalnum() for c in normalized) is False` é confusa. Decompondo:
- `len(normalized) <= 3` → string com ≤ 3 chars
- `not any(c.isalnum() for c in normalized)` → não tem nenhum alfanumérico
- `... is False` → nega de novo

Resultado: retorna `True` se a string tem ≤ 3 chars **e tem** pelo menos um alfanumérico. Mas isso já tá coberto pelo `normalized in trivial_greetings` pros casos que importam (`oi`, `ola`).

A skill: **"Sequential async flow where obviously independent work could stay simpler and clearer"** e **"Reframe the state model so conditionals disappear instead of getting centralized"**.

### Refatoração sugerida

```python
def _is_trivial_greeting(q: str) -> bool:
    return q.lower().strip().rstrip('!?') in TRIVIAL_GREETINGS

# declarar como module-level constant
TRIVIAL_GREETINGS = {"oi", "ola", "olá", "hi", "hey", "hello", "bom dia", ...}
```

Mata 8 linhas e remove 2 ramos inúteis.

---

## 5. ABSTRACTION EARNING ITS KEEP — `StructuredLogger` é wrapper sobre `logging.getLogger` que só formata JSON

**Localização:** `backend/main.py:67-93`
**Severidade:** suggestion

A skill: **"this abstraction seems unnecessary. can we just keep the direct flow?"** e **"thin wrappers or identity abstractions that add indirection without buying clarity"**.

```python
class StructuredLogger:
    def __init__(self, name):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)

    def info(self, msg, **kwargs):
        self.logger.info(json.dumps(self._format("info", msg, **kwargs)))
```

Compare com `logger = logging.getLogger("aria")`. O wrapper só adiciona:
- level no payload
- service="aria-backend"
- timestamp ISO

Tudo isso é configuração padrão de `logging.Formatter`. Pode ser feito com `logging.basicConfig` ou um `Formatter` custom. **26 linhas pra algo que `logging.Formatter` faz em 5**.

### Sugestão

```python
import logging
import json

class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "level": record.levelname.lower(),
            "msg": record.getMessage(),
            "service": "aria-backend",
            "time": self.formatTime(record),
        })

logger = logging.getLogger("aria")
handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)
logger.setLevel(logging.INFO)
```

---

## 6. BOUNDARY LEAK — `gpt-5.4-mini` chamado sync em rotas async

**Localização:** `backend/main.py:589` (upload-shifts), `1413` (chat/edit), `2710` (criar)
**Severidade:** warning

A skill: **"Unnecessary sequential orchestration and non-atomic updates as design smells"**.

O `/chat/stream` corretamente usa `asyncio.to_thread(...)` pro OpenAI sync. Mas:

- `/upload-shifts` (linha 589): `response = openai_client.chat.completions.create(...)` **bloqueia o event loop**
- `/chat/edit` (linha 1413): idem
- `/criar/{template}` (linha 2710): idem
- `/challenge/start` → `_generate_question` (linha 1722): idem

Em todas essas, **rotas já são async** (`async def`) mas a chamada OpenAI é sync. Em produção com Railway, isso bloqueia o worker até o LLM responder (3-10s).

### Code judo move

Padronizar via wrapper:

```python
async def chat_completion_async(**kwargs):
    return await asyncio.to_thread(openai_client.chat.completions.create, **kwargs)
```

E usar em todos os endpoints async. **Ou** migrar pra `AsyncOpenAI` (já tem no client oficial) e eliminar o `to_thread`. A skill pede **"Parallelize independent work when that also simplifies the orchestration"** — uma escolha unificada simplifica.

---

## 7. FILE-SIZE — `ChallengePage.jsx` em 971 linhas com 3 telas inline

**Localização:** `web/src/pages/ChallengePage.jsx`
**Severidade:** warning

Mesmo não passando de 1k, tá perto. E tem **3 telas** (SetupScreen, BattleScreen, ResultScreen) num único arquivo. Não há razão pra essas 3 telas ficarem juntas — compartilham só o `API_BASE` e `SPECIALTIES` constants.

### Code judo move

Dividir em:
- `pages/ChallengePage.jsx` (route + dispatch) — 30 linhas
- `pages/challenge/SetupScreen.jsx` — 350 linhas
- `pages/challenge/BattleScreen.jsx` — 350 linhas  
- `pages/challenge/ResultScreen.jsx` — 240 linhas
- `pages/challenge/constants.js` — API_BASE, SPECIALTIES

A skill: **"Split a large file into smaller focused modules"**.

---

## 8. SPAGHETTI BUG — `<div style={{ className: ..., style: ... }}>` no ChallengePage

**Localização:** `web/src/pages/ChallengePage.jsx:156` e `197`
**Severidade:** bug funcional

```jsx
<div style={{ className: 'challenge-grid-2', style: { marginBottom: 24 } }}>
```

`className` dentro de `style={{}}` **é silenciosamente ignorado** pelo React. Esse div vira `<div>` sem classe. O CSS responsivo `.challenge-grid-2 { display: grid; grid-template-columns: 1fr 1fr; }` definido no `<style>` da linha 107 **não aplica**. O resultado é layout quebrado em mobile.

A skill: **"Narrow edge-case handling implemented in the middle of an already busy function"** e **"Prefer direct, boring, maintainable code over hacky or magical code"**.

### Fix

```jsx
<div className="challenge-grid-2" style={{ marginBottom: 24 }}>
```

Repetido na linha 197 (`.challenge-grid-3`).

---

## 9. UNNECESSARY OPTIONALITY — `_maxStreak` é property privada vazada pelo frontend pro backend

**Localização:** `web/src/pages/ChallengePage.jsx:442-445`
**Severidade:** warning

```jsx
const handleFinish = async () => {
    // ...
    const data = await res.json()
    data._maxStreak = maxStreak  // ← prefixo "_" indica "interno"
    onFinish(data)
```

O resultado do `/challenge/finish` é um **response model do backend** (`user_score`, `ai_score`, `questions_detail`, etc). O frontend **adiciona** `_maxStreak` no objeto. Isso:

1. **Quebra o type contract** do backend
2. Vaza lógica de frontend pro shape de resposta
3. Se o backend adicionar `_maxStreak` real, conflita

A skill: **"Make type boundaries more explicit so the control flow gets simpler"**.

### Sugestão

Prop `_maxStreak` separado no `onFinish`, ou computar dentro do `ResultScreen` a partir de `questions_detail`.

---

## 10. NON-ATOMIC FLOW — `challenge_start` faz 5 inserts sequenciais

**Localização:** `backend/main.py:2055-2106`
**Severidade:** warning

O loop for de questões chama `httpx.post` em sequência, cada um indo pro Supabase. Se o usuário cair no meio (network drop, sessão caiu), fica um challenge "pela metade" — `challenges` row criada mas `challenge_questions` incompleto.

A skill: **"If related updates can leave state half-applied, push for a more atomic structure"**.

### Code judo move

Acumular todas as questões em memória e fazer **1 insert batch** via PostgREST. O Supabase suporta array de objetos em uma única chamada.

---

## Resumo priorizado

| # | Tipo | Severidade | Esforço |
|---|---|---|---|
| 1 | Estrutural | bloqueante | 4-6h (decompor routers) |
| 2 | Spaghetti | bloqueante | 1-2h (extrair supabase_client) |
| 3 | Type cleanliness | warning | 2h (extrair models.py) |
| 4 | Spaghetti (rama morta) | warning | 5min |
| 5 | Wrapper desnecessário | suggestion | 30min |
| 6 | Boundary leak (sync OpenAI) | warning | 1-2h (AsyncOpenAI ou to_thread wrapper) |
| 7 | File size ChallengePage | suggestion | 1-2h |
| 8 | Bug React (className em style) | bug | 2min |
| 9 | Optionality / boundary | warning | 15min |
| 10 | Non-atomic inserts | warning | 1h |

## Recomendação

Antes de mais features, **1+2+8** (estimativa: 5-8h). É o trabalho que destrava qualidade do resto sem reescrever lógica de negócio. Depois, **3+4+9+10** numa segunda passada (3-4h). **5+6+7** ficam pra uma terceira, se/quando houver tempo.

Os pilares que **não estão** no escopo deste review (não li o código interno):

- `Dashboard.jsx` (2083 linhas) — provável que tenha os mesmos padrões
- `Create.jsx` (1767 linhas) — idem
- `AdminUsers.jsx` (738 linhas)
- `Teams.jsx` (718 linhas)
- `Feed.jsx` (763 linhas)
- Scripts CBR (54 arquivos, ~10k linhas) — domínio separado, review próprio

## Pontos onde o código **está bom**

- `web/src/contexts/AuthContext.jsx` — bem estruturado, 180 linhas, role handling limpo, auto-create profile pra staff
- `web/src/pages/aria/ChatPanel.jsx` (351 linhas) — sub-módulo bem isolado, dividido em módulos coerentes (`Sidebar`, `ChatPanel`, `Icons`, `mardown`, `sessionCache`, `Style`, `constants`)
- System prompt ARIA é cuidadoso e bem escrito (linhas 377-459), só precisa sair do `main.py`
- Hybrid re-ranking em `/chat` (keyword boost + 2ª busca focada) é engenhoso e legível
- Score gate `top_boosted_score < 0.55` previne alucinações sem contexto

## Anti-patterns confirmados que **não aparecem** aqui

- Sem SQL injection (usa Supabase REST parametrizado)
- Sem secrets hardcoded (todos via env vars)
- Sem `console.log` em código de produção (backend usa `logger.info` estruturado)
- Sem TODOs óbvios no main.py (não encontrei `TODO`/`FIXME`/`HACK`)
- Sem bugs óbvios de auth bypass (JWT decode + profile lookup é robusto)

---
*Review by Hermes Agent usando skill `thermo-nuclear-code-quality-review` v1.0 de `Oreo992/skills`.*
