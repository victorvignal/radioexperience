"""
analyze_pilots.py - Quick quality audit across all pilot staging folders.
Prints chunk counts, short-chunk ratio, and a sample of suspicious chunks.
"""
import json
import sys
import pathlib

sys.stdout.reconfigure(encoding='utf-8')

STAGING = pathlib.Path(r"C:\Users\vigna\.openclaw\workspace\radioexperience\data\staging")
PILOTS = ["mama_pilot_v12", "torax_pilot_v1", "msk_pilot_v1", "neuro_pilot_v1"]


def analyze_pilot(folder: pathlib.Path):
    files = sorted(folder.glob("*.json"))
    if not files:
        return None
    total_chunks = 0
    short_chunks = 0
    file_results = []
    sample_bad = []

    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            file_results.append({"file": f.name, "error": str(e)})
            continue

        # Support both list-of-chunks and dict format (with 'all_chunks' or 'chunks' key)
        if isinstance(data, list):
            chunks = data
        elif isinstance(data, dict):
            chunks = data.get("all_chunks") or data.get("chunks") or []
            # if chunks is a count (int), skip
            if not isinstance(chunks, list):
                chunks = []
        else:
            chunks = []
        n_short = 0
        for c in chunks:
            text = c.get("text", "").strip()
            if len(text) < 30:
                n_short += 1
                if len(sample_bad) < 3:
                    sample_bad.append(repr(text[:80]))
        total_chunks += len(chunks)
        short_chunks += n_short
        file_results.append({"file": f.name[:70], "chunks": len(chunks), "short": n_short})

    return {
        "total_chunks": total_chunks,
        "short_chunks": short_chunks,
        "pct_short": round(100 * short_chunks / max(total_chunks, 1), 1),
        "files": file_results,
        "sample_bad": sample_bad,
    }


def main():
    for pilot_name in PILOTS:
        folder = STAGING / pilot_name
        if not folder.exists():
            print(f"\n[{pilot_name}] NOT FOUND")
            continue
        result = analyze_pilot(folder)
        if result is None:
            print(f"\n[{pilot_name}] No JSON files found")
            continue

        print(f"\n{'='*60}")
        print(f"Pilot: {pilot_name}")
        print(f"  Total chunks : {result['total_chunks']}")
        print(f"  Short (<30c) : {result['short_chunks']} ({result['pct_short']}%)")
        for fr in result["files"]:
            if "error" in fr:
                print(f"  ERROR {fr['file']}: {fr['error']}")
            else:
                print(f"  {fr['file']}: {fr['chunks']} chunks, {fr['short']} short")
        if result["sample_bad"]:
            print(f"  Sample bad   : {result['sample_bad']}")


if __name__ == "__main__":
    main()
