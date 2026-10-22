"""Google News Financial RSS provider adapter.

Uses targeted financial queries over HTTPS RSS without requiring an API key.
"""

from __future__ import annotations

import html
import logging
import re
from xml.etree import ElementTree

import httpx

from app.core.config import settings
from app.schemas.news import NewsCategory
from app.services.news.cache import cache_store, provider_cache_key
from app.services.news.types import ProviderFetchResult, RawProviderArticle

logger = logging.getLogger(__name__)

GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"
_TAG_RE = re.compile(r"<[^>]+>")

CATEGORY_RSS_QUERIES: dict[NewsCategory, str] = {
    "all": '("forex" OR "Federal Reserve" OR "central bank" OR "stock market" OR "S&P 500" OR "Bitcoin" OR "crude oil" OR "gold prices") when:7d',
    "forex": '("EUR/USD" OR "GBP/USD" OR "USD/JPY" OR "forex market" OR "currency markets" OR "US dollar index" OR "foreign exchange") when:7d',
    "central_banks": '("Federal Reserve" OR "FOMC" OR "European Central Bank" OR "Bank of England" OR "Bank of Japan" OR "interest rate decision" OR "monetary policy") when:7d',
    "economy": '("CPI inflation" OR "nonfarm payrolls" OR "GDP growth" OR "Treasury yields" OR "unemployment rate" OR "PMI data" OR "macroeconomic") when:7d',
    "crypto": '("Bitcoin" OR "Ethereum" OR "Solana" OR "crypto market" OR "spot Bitcoin ETF" OR "cryptocurrency regulation") when:7d',
    "stocks": '("stock market" OR "Wall Street earnings" OR "Nvidia" OR "Apple shares" OR "Microsoft stock" OR "Tesla shares" OR "quarterly earnings") when:7d',
    "indices": '("S&P 500" OR "Nasdaq 100" OR "Dow Jones" OR "FTSE 100" OR "DAX index" OR "Nikkei 225" OR "VIX index") when:7d',
    "commodities": '("gold prices" OR "XAU/USD" OR "WTI crude oil" OR "Brent crude" OR "OPEC" OR "silver futures" OR "commodities market") when:7d',
}


def build_rss_query(category: NewsCategory, search_query: str | None = None) -> str:
    base = CATEGORY_RSS_QUERIES.get(category, CATEGORY_RSS_QUERIES["all"])
    if search_query and search_query.strip():
        cleaned = re.sub(r"\s+", " ", search_query.strip())[:100]
        if category == "all":
            return f'({cleaned}) AND (market OR trading OR forex OR stocks OR crypto OR economy OR rate)'
        return f'({cleaned}) AND ({base})'
    return base


def _split_rss_title(title: str, publisher: str | None) -> tuple[str, str | None]:
    if " - " not in title:
        return title, publisher
    head, tail = title.rsplit(" - ", 1)
    tail = tail.strip()
    if not publisher and tail:
        publisher = tail
    if publisher and tail.lower() == publisher.lower() and head.strip():
        return head.strip(), publisher
    return title, publisher


def _extract_snippet(raw_description: str, headline: str, publisher: str | None) -> str | None:
    if not raw_description:
        return None
    unescaped = html.unescape(raw_description)
    plain = _TAG_RE.sub(" ", unescaped)
    plain = re.sub(r"\s+", " ", plain).strip()
    if not plain:
        return None
    if publisher and plain.endswith(publisher):
        plain = plain[: -len(publisher)].rstrip(" -–—")
    if plain.lower().startswith(headline.lower()):
        remainder = plain[len(headline) :].lstrip(" -–—:")
        if len(remainder) >= 24:
            return remainder[:320]
        return None
    if len(plain) >= 24:
        return plain[:320]
    return None


def parse_google_rss_xml(xml_text: str, *, max_items: int = 60) -> list[RawProviderArticle]:
    if not xml_text or not xml_text.strip():
        return []
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError as exc:
        raise ValueError("Invalid RSS XML payload") from exc

    articles: list[RawProviderArticle] = []
    for item in root.iter("item"):
        title_node = item.find("title")
        link_node = item.find("link")
        pub_node = item.find("pubDate")
        desc_node = item.find("description")
        source_node = item.find("source")
        guid_node = item.find("guid")

        raw_title = html.unescape(title_node.text or "").strip() if title_node is not None and title_node.text else ""
        link = (link_node.text or "").strip() if link_node is not None and link_node.text else ""
        if not raw_title or not link:
            continue

        publisher = (source_node.text or "").strip() if source_node is not None and source_node.text else None
        source_url = source_node.attrib.get("url") if source_node is not None else None
        source_domain = None
        if source_url and "://" in source_url:
            source_domain = source_url.split("://", 1)[1].split("/", 1)[0].lower().removeprefix("www.")

        clean_title, publisher = _split_rss_title(raw_title, publisher)
        raw_desc = desc_node.text if desc_node is not None and desc_node.text else ""
        snippet = _extract_snippet(raw_desc, clean_title, publisher)
        pub_date = (pub_node.text or "").strip() if pub_node is not None and pub_node.text else None
        guid = (guid_node.text or "").strip() if guid_node is not None and guid_node.text else None

        articles.append(
            RawProviderArticle(
                provider="google_rss",
                title=clean_title,
                url=link,
                published_at=pub_date,
                summary=snippet,
                source=publisher or "Financial News",
                source_domain=source_domain,
                external_id=guid,
                language="en",
            )
        )
        if len(articles) >= max_items:
            break

    return articles


def fetch_google_rss(
    category: NewsCategory,
    search_query: str | None = None,
    *,
    force_refresh: bool = False,
    client: httpx.Client | None = None,
) -> ProviderFetchResult:
    if not settings.news_google_rss_enabled:
        return ProviderFetchResult(
            provider="google_rss",
            enabled=False,
            healthy=False,
            status="disabled",
            detail="Disabled via NEWS_GOOGLE_RSS_ENABLED",
        )

    upstream_query = build_rss_query(category, search_query)
    cache_key = provider_cache_key("google_rss", upstream_query)
    ttl = max(30, int(settings.news_cache_ttl_seconds))

    if not force_refresh:
        cached, _ = cache_store.get_provider(cache_key, ttl)
        if cached is not None:
            return ProviderFetchResult(
                provider="google_rss",
                enabled=True,
                healthy=True,
                status="cached",
                articles=cached.articles,
            )

    owns = client is None
    http = client or httpx.Client(timeout=float(settings.news_provider_timeout_seconds), follow_redirects=True)
    try:
        resp = http.get(
            GOOGLE_NEWS_RSS_URL,
            params={"q": upstream_query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
            headers={"User-Agent": "TradeFix/1.0"},
        )
        if resp.status_code == 429:
            stale, _ = cache_store.get_provider(cache_key, ttl, allow_stale=True)
            return ProviderFetchResult(
                provider="google_rss",
                enabled=True,
                healthy=False,
                status="rate_limited",
                articles=stale.articles if stale else [],
                detail="Upstream RSS rate limited",
            )
        resp.raise_for_status()
        parsed = parse_google_rss_xml(resp.text)
        cache_store.put_provider(cache_key, parsed)
        return ProviderFetchResult(
            provider="google_rss",
            enabled=True,
            healthy=True,
            status="ok",
            articles=parsed,
        )
    except Exception as exc:
        logger.warning("google_rss adapter failed: %s", type(exc).__name__)
        stale, _ = cache_store.get_provider(cache_key, ttl, allow_stale=True)
        return ProviderFetchResult(
            provider="google_rss",
            enabled=True,
            healthy=False,
            status="error",
            articles=stale.articles if stale else [],
            detail=f"Google RSS unavailable ({type(exc).__name__})",
        )
    finally:
        if owns:
            http.close()
