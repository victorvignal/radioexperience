"""
Quick health check for RadioeXperience project.
Checks: .env, Qdrant connectivity, index stats, backend config.
Run from project root or scripts/.

Usage: python healthcheck.py
"""
import os
import sys
import io
from pathlib import Path
from dotenv import load_dotenv

# Fix Windows console encoding for emoji output
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

ok = "OK"
warn = "WARN"
fail = "FAIL"

def check_env():
    """Check .env variables."""
    required = ['OPENAI_API_KEY', 'QDRANT_URL', 'QDRANT_API_KEY']
    missing = [v for v in required if not os.getenv(v)]
    if missing:
        return fail, f"Missing env vars: {', '.join(missing)}"
    return ok, "All env vars set"

def check_qdrant():
    """Check Qdrant connectivity and index stats."""
    try:
        from qdrant_client import QdrantClient
        qdrant = QdrantClient(
            url=os.getenv("QDRANT_URL"),
            api_key=os.getenv("QDRANT_API_KEY"),
            timeout=10
        )
        col = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")
        total = qdrant.count(collection_name=col).count

        # Quick specialty scan (first 1000)
        result, _ = qdrant.scroll(collection_name=col, limit=1000, with_payload=['specialty'])
        from collections import Counter
        specs = Counter(p.payload.get('specialty', 'null') for p in result)
        null_pct = specs.get('null', 0) / len(result) * 100 if result else 0
        dup_count = specs.get('_duplicates', 0)
        scaled_dup = int(dup_count * total / len(result)) if result else 0

        lines = [f"Connected - {total:,} chunks indexed"]
        if null_pct > 5:
            lines.append(f"WARNING: {null_pct:.0f}% null specialty (est. ~{int(null_pct * total / 100):,} chunks)")
        if scaled_dup > 100:
            lines.append(f"WARNING: ~{scaled_dup:,} _duplicates chunks")
        return ok, "\n    ".join(lines)
    except Exception as e:
        return fail, f"Qdrant error: {e}"

def check_backend():
    """Check backend config exists."""
    backend = Path(__file__).parent.parent / "backend" / "main.py"
    if not backend.exists():
        return fail, "backend/main.py not found"
    return ok, "Backend FastAPI app present"

def check_frontend():
    """Check frontend files."""
    fe = Path(__file__).parent.parent / "frontend" / "index.html"
    if fe.exists():
        return ok, f"Standalone chat widget ({fe.stat().st_size:,} bytes)"
    return warn, "frontend/index.html not found"

def check_scripts():
    """Check scripts directory."""
    scripts_dir = Path(__file__).parent.parent / "scripts"
    if not scripts_dir.exists():
        return fail, "scripts/ not found"
    py_files = list(scripts_dir.glob("*.py"))
    ps1_files = list(scripts_dir.glob("*.ps1"))
    return ok, f"{len(py_files)} Python + {len(ps1_files)} PowerShell scripts"

def main():
    print("=" * 50)
    print("  RadioeXperience Health Check")
    print("=" * 50)

    checks = [
        ("Environment", check_env),
        ("Qdrant Index", check_qdrant),
        ("Backend", check_backend),
        ("Frontend", check_frontend),
        ("Scripts", check_scripts),
    ]

    for name, fn in checks:
        status, detail = fn()
        print(f"\n{status} {name}")
        print(f"    {detail}")

    print(f"\n{'='*50}")

if __name__ == '__main__':
    main()
