"""
scan_all_pdfs.py - Scan all PDFs in the RAG base and classify:
  - text_ok: text layer present (avg >= 100 chars/page in first 5 pages)
  - borderline: some text but sparse (20-99 chars/page)
  - needs_ocr: no/minimal text layer (< 20 chars/page)
  - error: failed to open

Outputs a CSV summary + console report.
"""
import sys
import csv
import pathlib
sys.stdout.reconfigure(encoding='utf-8')

from pypdf import PdfReader

RAG_BASE = pathlib.Path(r"C:\Users\vigna\.openclaw\workspace\RadioeXperienceRAG\raw")
OUTPUT_CSV = pathlib.Path(r"C:\Users\vigna\.openclaw\workspace\radioexperience\data\catalog\pdf_text_audit.csv")

SAMPLE_PAGES = 5  # pages to sample per PDF
THRESHOLD_OK = 100
THRESHOLD_BORDERLINE = 20


def classify(avg_chars: float) -> str:
    if avg_chars >= THRESHOLD_OK:
        return "text_ok"
    elif avg_chars >= THRESHOLD_BORDERLINE:
        return "borderline"
    else:
        return "needs_ocr"


def probe_pdf(path: pathlib.Path) -> dict:
    try:
        reader = PdfReader(str(path))
        total_pages = len(reader.pages)
        sample = list(range(min(SAMPLE_PAGES, total_pages)))
        chars = [len(reader.pages[i].extract_text() or "") for i in sample]
        avg = sum(chars) / max(len(chars), 1)
        status = classify(avg)
        return {
            "path": str(path.relative_to(RAG_BASE)),
            "file": path.name,
            "size_mb": round(path.stat().st_size / 1_048_576, 1),
            "pages": total_pages,
            "avg_chars_sample": round(avg, 0),
            "status": status,
            "error": "",
        }
    except Exception as e:
        return {
            "path": str(path.relative_to(RAG_BASE)),
            "file": path.name,
            "size_mb": round(path.stat().st_size / 1_048_576, 1),
            "pages": 0,
            "avg_chars_sample": 0,
            "status": "error",
            "error": str(e)[:120],
        }


def main():
    pdfs = sorted(RAG_BASE.rglob("*.pdf"))
    print(f"Found {len(pdfs)} PDFs under {RAG_BASE}")

    results = []
    for i, pdf in enumerate(pdfs, 1):
        print(f"  [{i:3d}/{len(pdfs)}] {pdf.name[:70]}", end="  ", flush=True)
        r = probe_pdf(pdf)
        results.append(r)
        print(f"{r['status']:12s} avg={r['avg_chars_sample']:6.0f}c/pg  {r['pages']}p")

    # Summary
    from collections import Counter
    counts = Counter(r["status"] for r in results)
    print("\n=== SUMMARY ===")
    for status, count in sorted(counts.items()):
        print(f"  {status:15s}: {count}")

    # CSV
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["path", "file", "size_mb", "pages", "avg_chars_sample", "status", "error"])
        writer.writeheader()
        writer.writerows(results)
    print(f"\nAudit saved to: {OUTPUT_CSV}")

    # List needs_ocr
    needs_ocr = [r for r in results if r["status"] == "needs_ocr"]
    if needs_ocr:
        print(f"\n[needs_ocr] {len(needs_ocr)} files:")
        for r in needs_ocr:
            print(f"  {r['path']}")


if __name__ == "__main__":
    main()
