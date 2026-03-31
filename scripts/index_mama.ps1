$base = "C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG"
$env:QDRANT_COLLECTION = "radioexperience_knowledge"
python .\radioexperience\scripts\rad_ingest.py index --input "$base\raw\mama" --limit 3
