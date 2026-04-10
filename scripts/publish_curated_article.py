#!/usr/bin/env python3
"""Publish at most one queued curated article per day to the community feed."""
import sys
from pathlib import Path

from dotenv import load_dotenv

from curated_articles import (
    create_feed_post,
    get_next_curated_article,
    has_published_article_today,
    mark_curated_article_published,
)

WORKSPACE = Path("/root/.openclaw/workspace/radioexperience")
load_dotenv(WORKSPACE / ".env")


def log(message: str):
    print(message)


def publish_next_curated_article() -> int:
    if has_published_article_today():
        log("A curated article was already published today. Nothing to do.")
        return 0

    article = get_next_curated_article()
    if not article:
        log("No indexed curated article is waiting in the editorial queue.")
        return 0

    post = create_feed_post(
        title=article.get("title") or "Untitled article",
        summary=article.get("summary"),
        source_url=article.get("source_url"),
        journal=article.get("source"),
        specialty=article.get("specialty"),
    )
    mark_curated_article_published(article["id"], feed_post_id=post.get("id") if post else None)

    log(
        "Published curated article to feed: "
        f"{article.get('title')} | source={article.get('source_url')} | post_id={post.get('id') if post else 'n/a'}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(publish_next_curated_article())
    except Exception as exc:
        log(f"Failed to publish curated article: {exc}")
        raise SystemExit(1)
