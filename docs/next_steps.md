# Next Steps — RadioeXperience

> Updated: 2026-03-31

## Quick Status
- **Index:** 117,191 chunks in Qdrant `radioexperience_knowledge`
- **Backend:** FastAPI with RAG (GPT-4o-mini) — ready, needs deploy credentials
- **Pipeline:** v12 (mature, 0 noise artifacts in mama pilot)
- **Blocking:** 16.4K unknown specialty chunks fixable with updated script

## Priority Actions

### P0 — Fix Unknown Chunks (ready to run)
```powershell
# Updated script reads from .env — no hardcoded creds
python .\radioexperience\scripts\fix_specialty_payload.py
```
Expected: ~16K chunks get proper specialty tags from path inference.

### P1 — Remove Duplicates
```powershell
python .\radioexperience\scripts\dedupe_and_cleanup.py
```
Removes 482 `_duplicates` chunks from Qdrant.

### P2 — Deploy Backend
Requires production credentials (OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY).
Config ready: `railway.json`, `Dockerfile`, `render.yaml`.

### P3 — OCR Pipeline (for 23 scanned PDFs)
High-value: BI-RADS v2025, CBR guidelines, Webb HRCT.
Options: tesseract (free), easyocr, surya (better layout).

### P4 — Frontend Integration
Connect chat widget to victorvignal.github.io or deploy standalone.

## Background Data
- 185 PDFs total: 154 text_ok, 4 borderline, 23 needs_ocr, 4 error
- Pilot validated: mama v12 (277 chunks, 0 noise)
- Specialty distribution: geral 34%, neurorradiologia 13%, pediatria 12%, intervenção 11%, abdome 10%
