# API Reference — ARIA Backend

Base URL: `http://localhost:8000` (local) or `https://aria-backend-production-176b.up.railway.app` (production)

## Endpoints

### `GET /health`

Check backend status and index stats.

**Response:**
```json
{
  "status": "ok",
  "collection": "radioexperience_knowledge",
  "documents_indexed": 117191,
  "collections": ["radioexperience_knowledge"]
}
```

**Error:**
```json
{
  "status": "error",
  "detail": "Connection refused"
}
```

---

### `GET /specialties`

List available specialties with approximate chunk counts.

**Response:**
```json
{
  "specialties": {
    "geral": 39694,
    "neurorradiologia": 15118,
    "pediatria": 14346,
    "intervencao": 12403,
    "abdome": 11479,
    "msk": 4087,
    "mama": 1283,
    "radioprotecao": 1132,
    "torax": 726
  },
  "total": 117191,
  "sampled": 5000
}
```

---

### `POST /chat`

RAG query — retrieve relevant chunks and generate answer with GPT-4o-mini.

**Request:**
```json
{
  "question": "O que é BI-RADS?",
  "top_k": 5,
  "specialty": "mama"           // optional: filter by specialty
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `question` | string | required | User question |
| `top_k` | int | 5 | Number of context chunks to retrieve |
| `specialty` | string | null | Filter results by specialty (e.g. "mama", "torax", "abdome") |

**Response:**
```json
{
  "answer": "BI-RADS (Breast Imaging Reporting and Data System) é...",
  "sources": [
    {
      "title": "Mama_Livro_Assessing_And_Improving...",
      "page_start": 42,
      "page_end": 45,
      "score": 0.8923,
      "excerpt": "O sistema BI-RADS classifica..."
    }
  ],
  "tokens_used": 847
}
```

**Error:**
```json
{
  "detail": "Embedding error: Invalid API key"
}
```

---

## CORS Origins (whitelisted)

- `https://victorvignal.github.io`
- `https://victorvignal.me`
- `http://localhost:5173` (Vite dev)
- `http://localhost:3000`
- `http://localhost:4173` (Vite preview)
- Pattern: `https://*.{github.io,railway.app,vercel.app,vercel.co,netlify.app}`

---

## Running Locally

```powershell
cd radioexperience/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then open `frontend/index.html` in a browser (or pass `?api=http://localhost:8000/chat`).
