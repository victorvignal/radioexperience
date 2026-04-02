#!/usr/bin/env python3
"""
ARIA Article Hunter v2 - AI-powered radiology article scraper.
Searches Radiopaedia (via FlareSolverr) and Radiology Assistant.
Evaluates with GPT, chunks cleanly, indexes to Qdrant.
"""
import os, sys, json, re, time, hashlib, urllib.request, urllib.parse, ssl
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
import httpx

# ── Config ──
WORKSPACE = Path("/root/.openclaw/workspace/radioexperience")
load_dotenv(WORKSPACE / ".env")

FLARESOLVERR_URL = "http://localhost:8191/v1"
OPENAI_MODEL = "gpt-4o-mini"
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
COLLECTION = os.getenv("QDRANT_COLLECTION", "radioexperience_knowledge")
MAX_ARTICLES = 15
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

# ── Clients ──
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
qdrant = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))

# ── Paths ──
ARTICLES_DIR = WORKSPACE / "articles"
INDEXED_FILE = WORKSPACE / "indexed_web_articles.json"
LOG_DIR = WORKSPACE / "logs"
ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / f"hunter_{datetime.now().strftime('%Y%m%d_%H%M')}.log"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def load_indexed():
    if INDEXED_FILE.exists():
        return json.loads(INDEXED_FILE.read_text(encoding="utf-8"))
    return {}

def save_indexed(data):
    INDEXED_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

# ══════════════════════════════════════════
# HTTP Fetching
# ══════════════════════════════════════════
def flaresolverr_get(url, timeout=60000):
    """Fetch URL through FlareSolverr (bypasses Cloudflare)."""
    payload = json.dumps({"cmd": "request.get", "url": url, "maxTimeout": timeout}).encode("utf-8")
    req = urllib.request.Request(FLARESOLVERR_URL, data=payload,
                                  headers={"Content-Type": "application/json"}, method="POST")
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=timeout//1000 + 30, context=ctx) as resp:
            data = json.loads(resp.read())
        if data.get("status") == "ok":
            return data.get("solution", {}).get("response", "")
        log(f"FlareSolverr error: {data.get('message','unknown')}")
        return None
    except Exception as e:
        log(f"FlareSolverr exception: {e}")
        return None

def simple_get(url):
    """Simple HTTP GET."""
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; ARIA/1.0)"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        log(f"HTTP error: {e}")
        return None

def smart_get(url, source):
    """Smart fetcher - uses FlareSolverr for Radiopaedia, simple for others."""
    if source == "radiopaedia":
        html = flaresolverr_get(url)
    else:
        html = simple_get(url)
        # If simple get returns too little content (JS-rendered), try FlareSolverr
        if html and len(extract_text(html)) < 200:
            log(f"  Simple get too short, trying FlareSolverr for {url[:60]}")
            html = flaresolverr_get(url)
    return html

# ══════════════════════════════════════════
# Discovery
# ══════════════════════════════════════════
def discover_radiopaedia():
    """Discover articles from Radiopaedia articles listing page."""
    articles = []
    
    # Fetch the articles listing page via FlareSolverr
    html = flaresolverr_get("https://radiopaedia.org/articles?lang=us")
    if not html:
        log("Could not fetch Radiopaedia articles page")
        return articles
    
    # Extract article URLs
    links = re.findall(r'href="(/articles/[^"?#]+)', html)
    unique_links = list(set(links))
    
    # Filter out non-article pages
    skip = {"/articles/new", "/articles/style-guide-and-help", "/articles/references-1",
            "/articles/medical-abbreviations-and-acronyms"}
    unique_links = [l for l in unique_links if not any(s in l for s in skip)]
    
    for link in unique_links[:MAX_ARTICLES]:
        articles.append({
            "url": f"https://radiopaedia.org{link}?lang=us",
            "slug": link.split("/")[-1],
            "source": "radiopaedia"
        })
    
    log(f"Radiopaedia: {len(articles)} articles found")
    return articles

def discover_radiology_assistant():
    """Discover articles from Radiology Assistant."""
    articles = []
    html = simple_get("https://radiologyassistant.nl")
    if not html:
        log("Could not fetch Radiology Assistant")
        return articles
    
    # Find all internal links
    links = re.findall(r'href="(/[^"]+)"', html)
    # Filter to content pages
    skip_patterns = {"/css/", "/js/", "/img/", "/fonts/", "mailto:", "http", "#"}
    content = [l for l in set(links) 
               if len(l) > 3 and l != "/" 
               and not any(p in l for p in skip_patterns)]
    
    for link in content[:MAX_ARTICLES]:
        articles.append({
            "url": f"https://radiologyassistant.nl{link}",
            "slug": link.strip("/").replace("/", "_"),
            "source": "radiologyassistant"
        })
    
    log(f"Radiology Assistant: {len(articles)} articles found")
    return articles

# ══════════════════════════════════════════
# Content Extraction
# ══════════════════════════════════════════
def extract_text(html):
    """Extract clean text from HTML."""
    if not html:
        return ""
    
    # Remove noise
    for pattern in [r'<script[^>]*>.*?</script>', r'<style[^>]*>.*?</style>',
                    r'<nav[^>]*>.*?</nav>', r'<footer[^>]*>.*?</footer>',
                    r'<header[^>]*>.*?</header>', r'<!--.*?-->',
                    r'<svg[^>]*>.*?</svg>']:
        html = re.sub(pattern, '', html, flags=re.DOTALL | re.IGNORECASE)
    
    # Extract main content area if present
    main_match = re.search(r'<main[^>]*>(.*?)</main>', html, re.DOTALL | re.IGNORECASE)
    if main_match:
        html = main_match.group(1)
    else:
        # Try article tag
        article_match = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL | re.IGNORECASE)
        if article_match:
            html = article_match.group(1)
    
    # Convert common HTML elements to text
    html = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<li[^>]*>', '• ', html, flags=re.IGNORECASE)
    html = re.sub(r'<h[1-6][^>]*>', '\n\n## ', html, flags=re.IGNORECASE)
    html = re.sub(r'</h[1-6]>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<p[^>]*>', '\n', html, flags=re.IGNORECASE)
    
    # Strip remaining tags
    text = re.sub(r'<[^>]+>', ' ', html)
    
    # Clean whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    
    return text

def extract_title(html):
    """Extract page title from HTML."""
    # Try og:title first
    match = re.search(r'<meta[^>]*property="og:title"[^>]*content="([^"]*)"', html, re.IGNORECASE)
    if match:
        title = match.group(1).strip()
    else:
        match = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
        title = re.sub(r'<[^>]+>', '', match.group(1)).strip() if match else "Unknown"
    
    # Clean site suffix
    for suffix in [" - Radiopaedia.org", " | Radiopaedia", " - The Radiology Assistant",
                   " : The Radiology Assistant", "The Radiology Assistant : "]:
        title = title.replace(suffix, "").strip()
    title = re.sub(r'\s*[-|:]\s*$', '', title)
    
    return title or "Unknown"

# ══════════════════════════════════════════
# AI Evaluation
# ══════════════════════════════════════════
EVAL_PROMPT = """Analise este conteúdo médico e responda em JSON:

{{"relevante": true/false, "especialidade": "Mama|Neurorradiologia|Abdome|Torax|Musculo-esqueletico|Pediatria|Cabeca/Pescoco|Geral", "qualidade": "alta|media|baixa", "resumo": "2-3 linhas"}}

Título: {titulo}
Fonte: {fonte}
Conteúdo:
{conteudo}"""

def evaluate(title, source, text):
    """GPT evaluates article relevance."""
    try:
        resp = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "Avaliador de conteúdo médico. Responda apenas JSON válido."},
                {"role": "user", "content": EVAL_PROMPT.format(
                    titulo=title, fonte=source, conteudo=text[:2000])},
            ],
            temperature=0.1, max_tokens=300,
        )
        raw = resp.choices[0].message.content.strip()
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        return json.loads(m.group()) if m else None
    except Exception as e:
        log(f"Eval error: {e}")
        return None

# ══════════════════════════════════════════
# Chunking & Indexing
# ══════════════════════════════════════════
def chunk_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """Smart text chunking with sentence boundary detection."""
    if len(text) <= size:
        return [text] if len(text) > 50 else []
    
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunk = text[start:end]
        
        # Break at sentence boundary if possible
        if end < len(text):
            for delim in ['. ', '.\n', '\n\n', '; ', ', ']:
                idx = chunk.rfind(delim)
                if idx > size * 0.4:
                    chunk = chunk[:idx + len(delim.strip())]
                    end = start + idx + len(delim.strip())
                    break
        
        chunk = chunk.strip()
        if len(chunk) > 50:
            chunks.append(chunk)
        start = end - overlap if end < len(text) else len(text)
    
    return chunks

def index_chunks(chunks, meta):
    """Embed and index chunks into Qdrant."""
    if not chunks:
        return 0
    
    try:
        embeddings = openai_client.embeddings.create(input=chunks, model=EMBED_MODEL).data
        points = []
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            pid = hashlib.md5(f"{meta['url']}_{i}".encode()).hexdigest()
            points.append(PointStruct(
                id=pid, vector=emb.embedding,
                payload={
                    "text": chunk,
                    "title": meta["title"],
                    "source": meta["source"],
                    "specialty": meta.get("specialty", "Geral"),
                    "url": meta["url"],
                    "page_start": i + 1,
                    "page_end": i + 1,
                }
            ))
        qdrant.upsert(collection_name=COLLECTION, points=points)
        return len(points)
    except Exception as e:
        log(f"Index error: {e}")
        return 0


# ══════════════════════════════════════════
# Supabase Feed Integration
# ══════════════════════════════════════════
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmZndlaW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.HxKGdH-kVL6p5knR2PgTgUl9OsIZ59G732StkQ8EXus")

def _supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

def post_to_feed(title, text, source_url, journal, specialty, summary):
    """Post an article to the Supabase feed."""
    try:
        # Truncate content for feed (keep it readable)
        feed_content = summary or text[:500]
        if len(feed_content) > 1000:
            feed_content = feed_content[:997] + "..."

        payload = {
            "type": "article",
            "title": title,
            "content": feed_content,
            "metadata": {
                "source": "aria_agent",
                "source_url": source_url,
                "journal": journal,
                "specialty": specialty,
                "author_name": "ARIA",
            },
        }
        r = httpx.post(
            f"{SUPABASE_URL}/rest/v1/posts",
            headers=_supabase_headers(),
            json=payload,
            timeout=15,
        )
        if r.status_code in (200, 201):
            log(f"  -> Posted to feed ✅")
            return True
        else:
            log(f"  -> Feed post failed: {r.status_code} {r.text[:100]}")
            return False
    except Exception as e:
        log(f"  -> Feed post error: {e}")
        return False

# ══════════════════════════════════════════
# Main Pipeline
# ══════════════════════════════════════════
def run():
    log("=" * 60)
    log("ARIA Article Hunter v2 - Starting")
    log("=" * 60)
    
    indexed = load_indexed()
    new_count = 0
    evaluated = 0
    
    # Discover
    articles = discover_radiopaedia() + discover_radiology_assistant()
    log(f"Total discovered: {len(articles)}")
    
    for article in articles:
        url = article["url"]
        if url in indexed:
            continue
        
        log(f"\n[{article['source']}] {article['slug'][:60]}")
        
        # Fetch
        html = smart_get(url, article["source"])
        if not html:
            log("  Fetch failed")
            continue
        
        # Extract
        title = extract_title(html)
        text = extract_text(html)
        
        if len(text) < 300:
            log(f"  Too short ({len(text)} chars), skipping")
            indexed[url] = {"title": title, "status": "short", "date": datetime.now().isoformat()}
            continue
        
        log(f"  Title: {title[:70]}")
        log(f"  Text: {len(text)} chars")
        
        # Evaluate
        ev = evaluate(title, article["source"], text)
        evaluated += 1
        
        if not ev or not ev.get("relevante"):
            log(f"  -> Not relevant")
            indexed[url] = {"title": title, "status": "irrelevant", "date": datetime.now().isoformat()}
            continue
        
        quality = ev.get("qualidade", "baixa")
        specialty = ev.get("especialidade", "Geral")
        
        if quality == "baixa":
            log(f"  -> Low quality")
            indexed[url] = {"title": title, "status": "low_quality", "date": datetime.now().isoformat()}
            continue
        
        log(f"  -> RELEVANT | {specialty} | {quality}")
        log(f"  -> {ev.get('resumo','')[:100]}")
        
        # Chunk & index
        chunks = chunk_text(text)
        count = index_chunks(chunks, {
            "title": title, "source": article["source"],
            "url": url, "specialty": specialty,
        })
        
        if count > 0:
            new_count += 1
            log(f"  -> Indexed {count} chunks")
            # Post to community feed
            post_to_feed(
                title=title,
                text=text,
                source_url=url,
                journal=article["source"],
                specialty=specialty,
                summary=ev.get("resumo", ""),
            )
            indexed[url] = {
                "title": title, "specialty": specialty, "quality": quality,
                "summary": ev.get("resumo"), "chunks": count,
                "status": "indexed", "date": datetime.now().isoformat(),
            }
        else:
            indexed[url] = {"title": title, "status": "index_fail", "date": datetime.now().isoformat()}
        
        time.sleep(3)  # Rate limit
    
    save_indexed(indexed)
    log(f"\n{'='*60}")
    log(f"DONE | Evaluated: {evaluated} | Indexed: {new_count} | Total tracked: {len(indexed)}")

if __name__ == "__main__":
    run()
