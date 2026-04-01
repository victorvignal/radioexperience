# Scripts — RadioeXperience

## Core Pipeline

| Script | Size | Purpose |
|--------|------|---------|
| `rad_ingest.py` | 31KB | Main ingestion: PDF → chunks → Qdrant |
| `fix_specialty_payload.py` | 3KB | Batch-fix specialty metadata from paths |
| `audit_text_quality.py` | 3.5KB | Score chunk quality (hyphens, stuck-é, fused tokens) |
| `review_problem_chunks.py` | 4.3KB | Interactive chunk inspector with search |
| `staging_search.py` | 3.3KB | Local semantic search over staging batches |

## Analysis & Auditing

| Script | Purpose |
|--------|---------|
| `scan_all_pdfs.py` | Audit all PDFs for text extractability |
| `analyze_pilots.py` | Analyze pilot batch output |
| `compare_pilots.py` | Compare two pilot batches side-by-side |
| `inspect_staging.py` | Inspect staging directory contents |
| `show_inventory.py` | Display book inventory |

## Organization

| Script | Purpose |
|--------|---------|
| `reorg_scan.py` | Scan for reorganization candidates |
| `reorg_apply.py` | Apply reorganization moves |
| `reorg_geral.py` | Reorganize geral specialty files |
| `dedupe_and_cleanup.py` | Remove duplicates from Qdrant |
| `extract_images_stub.py` | Extract images from PDFs |

## Testing

| Script | Purpose |
|--------|---------|
| `healthcheck.py` | Quick project health check (env, Qdrant, backend, frontend) |
| `openai_smoke_test.py` | Verify OpenAI API connectivity |
| `qdrant_smoke_test.py` | Verify Qdrant connectivity |
| `rag_test_query.py` | End-to-end RAG query test |
| `run_full_base_test.py` | Full base test suite |
| `resume_full_base_test.py` | Resume interrupted base test |
| `cleanup_qdrant.py` | Remove duplicate/unset specialty chunks from Qdrant |

## PowerShell Helpers

| Script | Purpose |
|--------|---------|
| `index_mama.ps1` | Index mama pilot batch |
| `inventory_mama.ps1` | Inventory mama books |
| `pilot_mama.ps1` | Run mama pilot ingestion |
| `run_mama_pilot_index.ps1` | Full mama pilot indexing |

## Cleanup Candidates
- `build_stack_doc.py`, `build_stack_doc_v2.py` — superseded by `build_stack_doc_v3.py`

## Notes
- All scripts read credentials from `../.env` (no hardcoded keys)
- Python 3.12+ required
- PowerShell scripts are Windows-specific
