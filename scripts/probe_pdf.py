"""
probe_pdf.py - Quick probe to check if a PDF yields extractable text.
Usage: python probe_pdf.py <pdf_path>
"""
import sys
import pathlib
sys.stdout.reconfigure(encoding='utf-8')

from pypdf import PdfReader

def probe(path_str):
    p = pathlib.Path(path_str)
    if not p.exists():
        print(f"NOT FOUND: {path_str}")
        return
    reader = PdfReader(str(p))
    total_pages = len(reader.pages)
    sample_pages = list(range(min(5, total_pages)))
    print(f"File   : {p.name}")
    print(f"Pages  : {total_pages}")
    total_chars = 0
    for i in sample_pages:
        t = reader.pages[i].extract_text() or ""
        total_chars += len(t)
        print(f"  Page {i+1:3d}: {len(t):5d} chars | {repr(t[:100])}")
    avg = total_chars / max(len(sample_pages), 1)
    print(f"Avg chars/page (sample): {avg:.0f}")
    if avg < 50:
        print("=> VERDICT: Likely scanned/image-only PDF (needs OCR)")
    else:
        print("=> VERDICT: Text layer present, pypdf extraction should work")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python probe_pdf.py <pdf_path>")
        sys.exit(1)
    probe(sys.argv[1])
