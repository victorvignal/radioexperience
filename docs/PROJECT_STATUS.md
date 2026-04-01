# RadioeXperience — Project Status Dashboard

> Last updated: 2026-03-31 (cron auto)

## ✅ What's Working

### RAG Pipeline (end-to-end)
- **Backend:** FastAPI with `/health`, `/specialties`, and `/chat` endpoints
- **Vector DB:** Qdrant cloud (117,191 chunks indexed)
- **Embeddings:** OpenAI text-embedding-3-small
- **Generation:** GPT-4o-mini with citation-aware system prompt
- **Retrieval:** Semantic search with optional specialty filtering
- **Frontend:** Chat widget (React/Vite, dark theme, source citations)

### Ingestion Pipeline
- `rad_ingest.py` v12 — mature, handles PDF parsing, OCR cleanup, chunking, image extraction
- `audit_text_quality.py` — automated quality scoring (hyphen breaks, stuck-é, fused tokens)
- `review_problem_chunks.py` — interactive chunk inspection
- `staging_search.py` — local semantic search over staging batches
- `scan_all_pdfs.py` — text quality audit across all 185 PDFs
- OCR cleanup pipeline: 0 hyphen breaks, 0 stuck-é, 0 fused tokens (v12)

### Documentation
- `docs/architecture_pipeline.md` — full RAG architecture spec
- `docs/ingestion_pipeline.md` — ingestion flow details
- `docs/multimodal_pipeline.md` — multimodal (image) pipeline
- `docs/API.md` — backend API reference with examples
- `docs/ocr_needed.md` — list of 23 PDFs needing OCR
- `docs/pilot_status.md` — mama pilot validation history (v4→v12)
- `docs/next_steps.md` — action items tracker
- `docs/retrieval_local.md` — local retrieval testing guide
- `docs/PROJECT_STATUS.md` — this file

---

## 🔧 What Needs Work

### 1. Fix 16,441 Unknown Specialty Chunks (HIGH)
- Chunks indexed before path-based specialty inference was added
- Paths clearly contain specialties (torax, mama, etc.)
- **Action:** Run `fix_specialty_payload.py` (now updated to read from `.env`)
- **Breakdown:** Mostly torax books (~4K), mama (~2K), and other specialties
- Script was previously blocked by hardcoded credentials — **now fixed**

### 2. Clean Up 482 Duplicate Chunks (MEDIUM)
- Indexed with `specialty: '_duplicates'`
- Safe to remove: `scripts/dedupe_and_cleanup.py` exists
- No impact on search quality (filtered out by backend query logic)

### 3. Deploy Backend (BLOCKED — needs credentials)
- Dockerfile and Railway config ready (`railway.json`, `render.yaml`, `Dockerfile`)
- **Needs:** `OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY` in production env

### 4. OCR for 23 Scanned PDFs (LOW priority)
- High-value items: BI-RADS v2025, CBR guidelines, Webb HRCT
- Options: tesseract, easyocr, surya
- Current pipeline skips these (flagged in `ocr_needed.md`)

### 5. Add Qdrant Index on `specialty` Field (LOW)
- Would enable efficient filtered counts and queries
- Currently requires full scroll for specialty-based analytics
- Can be done via Qdrant dashboard or client API

### 6. Frontend Integration (MEDIUM)
- Chat widget is standalone (`frontend/index.html`)
- Needs integration into `victorvignal.github.io` main site
- OR keep as separate app with proper CORS

---

## 📊 Index Distribution (verified 2026-03-31)

| Specialty | Chunks | % |
|-----------|--------|---|
| geral | 39,694 | 33.9% |
| _unset_ | 16,441 | 14.0% |
| neurorradiologia | 15,118 | 12.9% |
| pediatria | 14,346 | 12.2% |
| intervencao | 12,403 | 10.6% |
| abdome | 11,479 | 9.8% |
| msk | 4,087 | 3.5% |
| mama | 1,283 | 1.1% |
| radioprotecao | 1,132 | 1.0% |
| torax | 726 | 0.6% |
| _duplicates | 482 | 0.4% |

| Document Type | Chunks |
|---------------|--------|
| book | 113,643 |
| guideline | 3,054 |
| article | 494 |

---

## 🗂️ Script Inventory

### Core Pipeline
- `rad_ingest.py` (31KB) — main ingestion engine
- `fix_specialty_payload.py` — batch specialty fix (UPDATED: reads .env now)
- `audit_text_quality.py` — chunk quality scoring
- `review_problem_chunks.py` — chunk inspector
- `staging_search.py` — local semantic search

### Utilities
- `scan_all_pdfs.py` — PDF text quality audit
- `analyze_pilots.py` — pilot batch analysis
- `compare_pilots.py` — cross-batch comparison
- `inspect_staging.py` — staging directory inspector
- `dedupe_and_cleanup.py` — duplicate removal
- `reorg_scan.py` / `reorg_apply.py` / `reorg_geral.py` — file reorganization

### Testing & Maintenance
- `healthcheck.py` — quick project health check (env, Qdrant, backend, frontend)
- `openai_smoke_test.py` — OpenAI API check
- `qdrant_smoke_test.py` — Qdrant connectivity check
- `rag_test_query.py` — end-to-end RAG query test
- `run_full_base_test.py` / `resume_full_base_test.py` — full base testing
- `cleanup_qdrant.py` — remove _duplicates/unset specialty chunks from Qdrant

### Cleanup Candidates (redundant versions)
- `build_stack_doc.py`, `build_stack_doc_v2.py` → archive, keep `build_stack_doc_v3.py`
