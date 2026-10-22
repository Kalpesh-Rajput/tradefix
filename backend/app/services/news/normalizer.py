"""Article normalization, sanitization, URL validation, and cross-provider deduplication."""

from __future__ import annotations

import hashlib
import html
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.core.config import settings
from app.schemas.news import NewsCategory, NewsSentiment
from app.services.news.classifier import (
    classify_category,
    compute_relevance_score,
    extract_symbols,
    is_financially_relevant,
)
from app.services.news.types import NormalizedArticle, RawProviderArticle

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WHITESPACE_RE = re.compile(r"\s+")
_FINGERPRINT_RE = re.compile(r"[^a-z0-9]+")

_TRACKING_PARAMS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
        "ref",
        "rss",
    }
)


def sanitize_text(value: str | None, *, max_length: int = 512) -> str:
    if not value:
        return ""
    unescaped = html.unescape(str(value))
    no_tags = _HTML_TAG_RE.sub(" ", unescaped)
    no_ctrl = _CONTROL_RE.sub("", no_tags)
    collapsed = _WHITESPACE_RE.sub(" ", no_ctrl).strip()
    if len(collapsed) > max_length:
        return collapsed[: max_length - 1].rstrip() + "…"
    return collapsed


def validate_and_canonicalize_url(raw_url: str | None) -> tuple[str, str, str | None] | None:
    """Validate that a URL is safe HTTP(S) and return (clean_url, canonical_url, hostname)."""
    if not raw_url or not isinstance(raw_url, str):
        return None
    candidate = raw_url.strip()
    if not candidate or len(candidate) > 2048:
        return None
    if _CONTROL_RE.search(candidate):
        return None
    try:
        parsed = urlparse(candidate)
    except ValueError:
        return None

    scheme = (parsed.scheme or "").lower()
    if scheme not in {"https", "http"}:
        return None
    hostname = (parsed.hostname or "").lower().strip(".")
    if not hostname or "." not in hostname or " " in hostname:
        return None

    clean_url = urlunparse(
        (
            scheme,
            parsed.netloc,
            parsed.path or "/",
            parsed.params,
            parsed.query,
            "",  # strip fragment
        )
    )

    filtered_query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=False)
        if k.lower() not in _TRACKING_PARAMS
    ]
    filtered_query.sort()
    canonical_path = (parsed.path or "/").rstrip("/") or "/"
    canonical_url = urlunparse(
        (
            "https",
            hostname.removeprefix("www."),
            canonical_path,
            "",
            urlencode(filtered_query),
            "",
        )
    )
    return clean_url, canonical_url, hostname.removeprefix("www.")


def validate_image_url(raw_url: str | None) -> str | None:
    if not settings.news_enable_thumbnails:
        return None
    if not raw_url or not isinstance(raw_url, str):
        return None
    res = validate_and_canonicalize_url(raw_url)
    if res is None:
        return None
    clean_url, _canonical, _host = res
    if not clean_url.lower().startswith("https://"):
        return None
    return clean_url


def parse_utc_timestamp(value: datetime | str | int | float | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except (ValueError, OSError, OverflowError):
            return None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        # GDELT compact format: YYYYMMDDTHHMMSSZ or YYYYMMDDHHMMSS
        m = re.fullmatch(r"(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?", text)
        if m:
            try:
                y, mo, d, h, mi, s = (int(part) for part in m.groups())
                return datetime(y, mo, d, h, mi, s, tzinfo=timezone.utc)
            except ValueError:
                return None
        # ISO-8601 format
        try:
            iso = text.replace("Z", "+00:00") if text.endswith("Z") else text
            dt = datetime.fromisoformat(iso)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        except ValueError:
            pass
        # RFC-2822 (RSS pubDate)
        try:
            dt = parsedate_to_datetime(text)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        except (TypeError, ValueError, IndexError):
            return None
    return None


def normalize_sentiment(
    label: str | None,
    score: float | None,
) -> tuple[NewsSentiment | None, float | None]:
    if score is not None:
        try:
            val = max(-1.0, min(1.0, float(score)))
        except (TypeError, ValueError):
            val = None
        if val is not None:
            if val > 0.12:
                return "positive", round(val, 4)
            if val < -0.12:
                return "negative", round(val, 4)
            return "neutral", round(val, 4)

    if label:
        norm = label.strip().lower()
        if norm in {"positive", "bullish"}:
            return "positive", None
        if norm in {"negative", "bearish"}:
            return "negative", None
        if norm == "neutral":
            return "neutral", None
    return None, None


def _clean_source_name(source: str | None, domain: str | None) -> str:
    cleaned = sanitize_text(source, max_length=80)
    if cleaned:
        return cleaned
    if domain:
        return domain
    return "Financial Wire"


def _strip_Duplicate_summary(title: str, summary: str | None, source: str) -> str | None:
    if not summary:
        return None
    cleaned = sanitize_text(summary, max_length=360)
    if not cleaned:
        return None
    # Google News RSS descriptions often just repeat the headline + publisher name
    norm_title = _FINGERPRINT_RE.sub("", title.lower())
    norm_sum = _FINGERPRINT_RE.sub("", cleaned.lower())
    norm_source = _FINGERPRINT_RE.sub("", source.lower())
    if not norm_sum or norm_sum == norm_title or norm_sum == (norm_title + norm_source):
        return None
    if norm_sum.startswith(norm_title) and len(norm_sum) - len(norm_title) <= len(norm_source) + 6:
        return None
    return cleaned


def compute_article_id(canonical_url: str, title: str, source: str) -> str:
    basis = canonical_url or f"{source.lower()}|{_FINGERPRINT_RE.sub(' ', title.lower()).strip()}"
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:20]


def normalize_raw_article(
    raw: RawProviderArticle,
    *,
    hint_category: NewsCategory | None = None,
    search_query: str | None = None,
) -> NormalizedArticle | None:
    title = sanitize_text(raw.title, max_length=300)
    if not title or len(title) < 8:
        return None

    url_info = validate_and_canonicalize_url(raw.url)
    if url_info is None:
        return None
    clean_url, canonical_url, hostname = url_info

    published_at = parse_utc_timestamp(raw.published_at)
    if published_at is None:
        return None

    source_domain = sanitize_text(raw.source_domain or hostname, max_length=120) or hostname
    source = _clean_source_name(raw.source, source_domain)
    summary = _strip_Duplicate_summary(title, raw.summary, source)

    symbols, symbols_source = extract_symbols(title, summary, raw.provider_symbols)
    if not is_financially_relevant(title, summary, symbols):
        return None

    category = classify_category(
        title,
        summary,
        symbols=symbols,
        provider_entity_types=raw.provider_entity_types,
        hint_category=hint_category,
    )
    sentiment, sentiment_score = normalize_sentiment(raw.provider_sentiment, raw.provider_sentiment_score)
    image_url = validate_image_url(raw.image_url)
    article_id = compute_article_id(canonical_url, title, source)
    relevance_score = compute_relevance_score(title, summary, symbols, category, search_query=search_query)

    return NormalizedArticle(
        id=article_id,
        title=title,
        summary=summary,
        source=source,
        source_domain=source_domain,
        url=clean_url,
        canonical_url=canonical_url,
        published_at=published_at,
        category=category,
        symbols=symbols,
        symbols_source=symbols_source,
        sentiment=sentiment,
        sentiment_score=sentiment_score,
        image_url=image_url,
        language=(raw.language or "en")[:8].lower(),
        provider=raw.provider,
        relevance_score=relevance_score,
    )


def headline_fingerprint(title: str) -> str:
    cleaned = _FINGERPRINT_RE.sub(" ", title.lower()).strip()
    tokens = [tok for tok in cleaned.split() if len(tok) > 2]
    return " ".join(tokens[:12])


def merge_duplicate_articles(existing: NormalizedArticle, incoming: NormalizedArticle) -> NormalizedArticle:
    """Merge metadata from two duplicate records, preserving provider sentiment and richer summaries."""
    summary = existing.summary or incoming.summary
    if existing.summary and incoming.summary and len(incoming.summary) > len(existing.summary):
        summary = incoming.summary

    sentiment = existing.sentiment or incoming.sentiment
    sentiment_score = existing.sentiment_score if existing.sentiment_score is not None else incoming.sentiment_score

    symbols = list(existing.symbols)
    for sym in incoming.symbols:
        if sym not in symbols:
            symbols.append(sym)
    symbols = symbols[:8]

    symbols_source = (
        "provider"
        if "provider" in (existing.symbols_source, incoming.symbols_source)
        else ("contextual" if symbols else "none")
    )

    provider = existing.provider
    if incoming.provider == "marketaux" and existing.provider != "marketaux":
        provider = "marketaux"

    return NormalizedArticle(
        id=existing.id,
        title=existing.title,
        summary=summary,
        source=existing.source,
        source_domain=existing.source_domain or incoming.source_domain,
        url=existing.url,
        canonical_url=existing.canonical_url,
        published_at=max(existing.published_at, incoming.published_at),
        category=existing.category if existing.category != "all" else incoming.category,
        symbols=symbols,
        symbols_source=symbols_source,
        sentiment=sentiment,
        sentiment_score=sentiment_score,
        image_url=existing.image_url or incoming.image_url,
        language=existing.language,
        provider=provider,
        relevance_score=max(existing.relevance_score, incoming.relevance_score),
    )


def deduplicate_articles(articles: list[NormalizedArticle]) -> list[NormalizedArticle]:
    by_canonical: dict[str, int] = {}
    by_fingerprint: dict[str, int] = {}
    deduped: list[NormalizedArticle] = []

    for article in articles:
        fp = headline_fingerprint(article.title)
        fp_key = f"{fp}|{article.published_at.strftime('%Y-%m-%d')}" if fp else ""

        idx = by_canonical.get(article.canonical_url)
        if idx is None and fp_key and len(fp) >= 18:
            idx = by_fingerprint.get(fp_key)

        if idx is not None:
            deduped[idx] = merge_duplicate_articles(deduped[idx], article)
            continue

        new_idx = len(deduped)
        deduped.append(article)
        if article.canonical_url:
            by_canonical[article.canonical_url] = new_idx
        if fp_key and len(fp) >= 18:
            by_fingerprint[fp_key] = new_idx

    return deduped
