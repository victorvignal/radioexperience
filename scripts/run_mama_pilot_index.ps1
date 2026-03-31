# RadioeXperience — Indexação piloto mama (v8+)
# Requires: OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY (no .env or environment)

$env:QDRANT_COLLECTION = "radioexperience_knowledge"

Write-Host "=== Smoke tests ==="
python .\radioexperience\scripts\openai_smoke_test.py
if ($LASTEXITCODE -ne 0) { Write-Error "OpenAI smoke test failed"; exit 1 }

python .\radioexperience\scripts\qdrant_smoke_test.py
if ($LASTEXITCODE -ne 0) { Write-Error "Qdrant smoke test failed"; exit 1 }

Write-Host ""
Write-Host "=== Indexing 3 pilot books ==="
python .\radioexperience\scripts\rad_ingest.py index `
    --input ".\radioexperience\data\raw\mama" `
    --limit 3 `
    --images-dir ".\radioexperience\data\processed\images"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Done. Run a test query:"
    Write-Host "  python .\radioexperience\scripts\staging_search.py --input .\radioexperience\data\staging\mama_pilot_v8 --query `"calcificações mamografia`" --top 5"
}
