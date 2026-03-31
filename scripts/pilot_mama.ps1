$base = "C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG"
python .\radioexperience\scripts\rad_ingest.py pilot --input "$base\raw\mama" --limit 5 --output-dir "$base\processed\staging\mama_pilot" --images-dir "$base\processed\images"
