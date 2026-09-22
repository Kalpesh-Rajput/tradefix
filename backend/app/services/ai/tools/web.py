from __future__ import annotations

import hashlib
import html
import re
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

import httpx

from app.services.ai.tools.context import SourceRef, ToolContext

_NEWS_RSS = "https://news.google.com/rss/search"
_TAG = re.compile(r"<[^>]+>")
_MAX_RESULTS = 5


def parse_news_rss(xml_text: str) -> list[dict]:
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return []
    items: list[dict] = []
    for node in root.iter("item"):
        title = _text(node, "title")
        link = _text(node, "link")
        if not title or not link.lower().startswith("https://"):
            continue
        source = node.find("source")
        publisher = (source.text or "").strip() if source is not None and source.text else None
        title, publisher = _split_title(title, publisher)
        snippet = _snippet(_text(node, "description"))
        published = _published(_text(node, "pubDate"))
        items.append(
            {
                "title": title,
                "url": link,
                "publisher": publisher,
                "snippet": snippet,
                "published": published,
            }
        )
        if len(items) >= _MAX_RESULTS:
            break
    return items


def search_web(ctx: ToolContext, args: dict) -> dict:
    query = _clean_query(str(args.get("query") or ""))
    if not query:
        return {"error": True, "message": "A search query is required."}
    try:
        xml_text = _fetch_rss(query)
    except Exception:
        ctx.warnings.append("Web search is unavailable right now.")
        return {"error": True, "message": "Web search is unavailable right now.", "query": query}

    articles = parse_news_rss(xml_text)
    if not articles:
        return {"query": query, "results": [], "message": "No recent articles matched that search."}

    results = []
    for article in articles:
        source_id = hashlib.sha256(article["url"].encode()).hexdigest()[:16]
        ctx.add_source(
            SourceRef(
                type="web",
                id=source_id,
                title=article["title"],
                date=article["published"],
                url=article["url"],
                snippet=article["snippet"],
                publisher=article["publisher"],
            )
        )
        results.append(article)
    return {"query": query, "results": results}


def _fetch_rss(query: str) -> str:
    response = httpx.get(
        _NEWS_RSS,
        params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
        timeout=8.0,
        follow_redirects=True,
        headers={"User-Agent": "TradeFix/1.0"},
    )
    response.raise_for_status()
    return response.text


def _clean_query(value: str) -> str:
    text = re.sub(r"\s+", " ", value).strip()
    return text[:160]


def _text(node: ElementTree.Element, tag: str) -> str:
    child = node.find(tag)
    if child is None or child.text is None:
        return ""
    return html.unescape(child.text).strip()


def _snippet(value: str) -> str | None:
    plain = _TAG.sub(" ", value)
    plain = re.sub(r"\s+", " ", html.unescape(plain)).strip()
    if not plain:
        return None
    return plain[:220]


def _published(value: str) -> str | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError, IndexError):
        return None


def _split_title(title: str, publisher: str | None) -> tuple[str, str | None]:
    if " - " not in title:
        return title, publisher
    head, tail = title.rsplit(" - ", 1)
    tail = tail.strip()
    if not publisher:
        publisher = tail or None
    if publisher and tail.lower() == publisher.lower() and head.strip():
        return head.strip(), publisher
    return title, publisher
