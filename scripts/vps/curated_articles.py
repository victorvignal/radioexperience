#!/usr/bin/env python3
"""Shared helpers for curated article queue + Supabase feed publishing."""
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx


def supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "https://pcdequsipbkxcfsewiow.supabase.co")


def supabase_service_key() -> str:
    return os.getenv(
        "SUPABASE_SERVICE_KEY",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmZndlaW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.HxKGdH-kVL6p5knR2PgTgUl9OsIZ59G732StkQ8EXus",
    )


def app_timezone() -> str:
    return os.getenv("APP_TIMEZONE", "America/Sao_Paulo")


def author_name() -> str:
    return os.getenv("CURATED_ARTICLE_AUTHOR_NAME", "ARIA")


def curated_source() -> str:
    return os.getenv("CURATED_ARTICLE_SOURCE", "aria_agent")


def supabase_headers(prefer: str | None = None):
    service_key = supabase_service_key()
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def now_local() -> datetime:
    return datetime.now(ZoneInfo(app_timezone()))


def now_iso() -> str:
    return now_local().isoformat()


def today_start_iso() -> str:
    current = now_local()
    start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.isoformat()


def build_feed_content(
    *, title: str, summary: str | None, source_url: str, journal: str | None, specialty: str | None
) -> str:
    """Build a rich, well-formatted post body with summary + source link."""
    parts = []

    # Optional summary from the AI evaluation
    clean_summary = (summary or "").strip()
    if clean_summary:
        parts.append(clean_summary)

    # Why it matters
    specialty_clean = (specialty or "Medicina").strip() or "Medicina"
    parts.append(
        f"Este artigo é relevante para a especialidade de {specialty_clean}, "
        f"oferecendo insights práticos para Radiologia e diagnóstico por imagem."
    )

    content = "\n\n".join(parts)

    # Truncate if too long
    if len(content) > 900:
        content = content[:900].rsplit(" ", 1)[0] + "..."

    # Source link — always appended
    journal_label = (journal or "Artigo Original").strip()
    content += (
        f"\n\n---\n"
        f"Leia o artigo completo em {journal_label}:\n"
        f"{source_url}"
    )

    return content


def upsert_curated_article(article: dict):
    response = httpx.post(
        f"{supabase_url()}/rest/v1/curated_articles",
        headers=supabase_headers("resolution=merge-duplicates,return=representation"),
        params={"on_conflict": "source_url"},
        json=article,
        timeout=20,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None


def fetch_curated_article_urls() -> set[str]:
    response = httpx.get(
        f"{supabase_url()}/rest/v1/curated_articles",
        headers=supabase_headers(),
        params={"select": "source_url", "limit": "5000"},
        timeout=20,
    )
    response.raise_for_status()
    return {row["source_url"] for row in response.json() if row.get("source_url")}


def has_published_article_today() -> bool:
    response = httpx.get(
        f"{supabase_url()}/rest/v1/curated_articles",
        headers=supabase_headers(),
        params={
            "select": "id",
            "status": "eq.published",
            "published_to_feed_at": f"gte.{today_start_iso()}",
            "order": "published_to_feed_at.asc",
            "limit": "1",
        },
        timeout=20,
    )
    response.raise_for_status()
    return len(response.json()) > 0


def get_next_curated_article():
    response = httpx.get(
        f"{supabase_url()}/rest/v1/curated_articles",
        headers=supabase_headers(),
        params={
            "select": "*",
            "status": "eq.indexed",
            "published_to_feed_at": "is.null",
            "order": "indexed_at.asc",
            "limit": "1",
        },
        timeout=20,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None


def create_feed_post(
    *, title: str, summary: str | None, source_url: str, journal: str | None, specialty: str | None
):
    payload = {
        "type": "article",
        "title": title,
        "content": build_feed_content(
            title=title,
            summary=summary,
            source_url=source_url,
            journal=journal,
            specialty=specialty,
        ),
        "is_agent": True,
        "metadata": {
            "source": curated_source(),
            "source_url": source_url,
            "journal": journal,
            "specialty": specialty,
            "author_name": author_name(),
        },
    }
    response = httpx.post(
        f"{supabase_url()}/rest/v1/posts",
        headers=supabase_headers("return=representation"),
        json=payload,
        timeout=20,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None


def mark_curated_article_published(article_id: str, *, feed_post_id: str | None = None):
    payload = {
        "status": "published",
        "published_to_feed_at": now_iso(),
    }
    if feed_post_id:
        payload["feed_post_id"] = feed_post_id

    response = httpx.patch(
        f"{supabase_url()}/rest/v1/curated_articles",
        headers=supabase_headers("return=representation"),
        params={"id": f"eq.{article_id}"},
        json=payload,
        timeout=20,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None
