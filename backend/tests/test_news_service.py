"""Unit tests for the Financial News Terminal backend service:
- Provider response parsing (Google RSS XML, GDELT JSON, Marketaux JSON)
- Normalization, UTC timestamps, HTML stripping, and URL safety validation
- Contextual instrument classification and anti-false-positive rules
- Cross-provider deduplication and metadata merging
- Two-tier cache key strategy, TTL reuse, GDELT 5.5s pacing, Marketaux daily quota guard
- Partial provider failure resilience and stale-cache fallback
- Featured story selection from filtered/sorted candidate pool
- Optional live upstream smoke tests (opt-in via RUN_LIVE_NEWS_SMOKE=1)
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.services.news import load_candidate_pool, reset_news_state, select_featured_article
from app.services.news.cache import cache_store, pool_cache_key, provider_cache_key
from app.services.news.classifier import classify_category, extract_symbols, is_financially_relevant
from app.services.news.normalizer import (
    deduplicate_articles,
    normalize_raw_article,
    parse_utc_timestamp,
    sanitize_text,
    validate_and_canonicalize_url,
)
from app.services.news.providers import (
    fetch_gdelt_doc,
    fetch_google_rss,
    fetch_marketaux,
    get_marketaux_quota_used,
    parse_gdelt_json,
    parse_google_rss_xml,
    parse_marketaux_json,
)
from app.services.news.types import ProviderFetchResult, RawProviderArticle


@pytest.fixture(autouse=True)
def _reset_state():
    reset_news_state()
    yield
    reset_news_state()


SAMPLE_RSS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>EUR/USD climbs after ECB holds interest rates steady - Reuters</title>
      <link>https://www.reuters.com/markets/currencies/eurusd-ecb-rates-2026/?utm_source=rss&amp;fbclid=123</link>
      <pubDate>Thu, 22 Oct 2026 10:30:00 GMT</pubDate>
      <description>&lt;a href="https://www.reuters.com"&gt;EUR/USD climbs after ECB holds interest rates steady&lt;/a&gt; - European Central Bank officials signaled patience on inflation targets across the euro zone.</description>
      <source url="https://www.reuters.com">Reuters</source>
      <guid>guid-1</guid>
    </item>
    <item>
      <title>Bitcoin surges past resistance as spot ETF inflows accelerate - CoinDesk</title>
      <link>https://www.coindesk.com/markets/2026/10/22/btc-etf-inflows/</link>
      <pubDate>Thu, 22 Oct 2026 09:15:00 GMT</pubDate>
      <description>Institutional demand for BTC/USD lifted crypto market volume during the London session.</description>
      <source url="https://www.coindesk.com">CoinDesk</source>
      <guid>guid-2</guid>
    </item>
  </channel>
</rss>
"""

SAMPLE_GDELT_JSON = {
    "articles": [
        {
            "url": "https://www.ft.com/content/fed-fomc-treasury-yields-2026",
            "title": "Federal Reserve signals measured pace on rate adjustments as Treasury yields steady",
            "seendate": "20261022T110000Z",
            "socialimage": "https://www.ft.com/image.jpg",
            "domain": "ft.com",
            "language": "English",
            "sourcecountry": "United Kingdom",
        },
        {
            "url": "https://www.reuters.com/markets/currencies/eurusd-ecb-rates-2026/",
            "title": "EUR/USD climbs after ECB holds interest rates steady",
            "seendate": "20261022T103000Z",
            "domain": "reuters.com",
            "language": "English",
        },
    ]
}

SAMPLE_MARKETAUX_JSON = {
    "meta": {"found": 2, "returned": 2, "limit": 3, "page": 1},
    "data": [
        {
            "uuid": "mkt-uuid-1",
            "title": "EUR/USD climbs after ECB holds interest rates steady",
            "description": "European Central Bank policymakers held deposit rates steady while EUR/USD rose 0.4%.",
            "snippet": "ECB holds rates...",
            "url": "https://www.reuters.com/markets/currencies/eurusd-ecb-rates-2026/",
            "image_url": "https://www.reuters.com/img.jpg",
            "language": "en",
            "published_at": "2026-10-22T10:31:00.000000Z",
            "source": "reuters.com",
            "entities": [
                {
                    "symbol": "EURUSD",
                    "name": "EUR/USD",
                    "type": "currency",
                    "sentiment_score": 0.62,
                }
            ],
        },
        {
            "uuid": "mkt-uuid-2",
            "title": "Nvidia shares retreat as semiconductor export rules tighten",
            "description": "Nvidia Corp shares slipped in pre-market trading following updated guidance.",
            "url": "https://www.bloomberg.com/news/articles/2026-10-22/nvda-chips",
            "language": "en",
            "published_at": "2026-10-22T08:00:00.000000Z",
            "source": "bloomberg.com",
            "entities": [
                {
                    "symbol": "NVDA",
                    "name": "Nvidia Corp",
                    "type": "equity",
                    "sentiment_score": -0.54,
                }
            ],
        },
    ],
}


def test_parse_google_rss_xml():
    items = parse_google_rss_xml(SAMPLE_RSS_XML)
    assert len(items) == 2
    assert items[0].title == "EUR/USD climbs after ECB holds interest rates steady"
    assert items[0].source == "Reuters"
    assert items[0].source_domain == "reuters.com"
    assert items[0].summary is not None and "European Central Bank" in items[0].summary


def test_parse_gdelt_json():
    items = parse_gdelt_json(SAMPLE_GDELT_JSON)
    assert len(items) == 2
    assert items[0].provider == "gdelt"
    assert items[0].source_domain == "ft.com"
    dt = parse_utc_timestamp(items[0].published_at)
    assert dt == datetime(2026, 10, 22, 11, 0, 0, tzinfo=timezone.utc)


def test_parse_marketaux_json():
    items = parse_marketaux_json(SAMPLE_MARKETAUX_JSON)
    assert len(items) == 2
    assert items[0].provider_symbols == ["EURUSD"]
    assert items[0].provider_sentiment_score == pytest.approx(0.62)
    assert items[1].provider_symbols == ["NVDA"]
    assert items[1].provider_sentiment_score == pytest.approx(-0.54)


def test_url_validation_and_canonicalization():
    assert validate_and_canonicalize_url("javascript:alert(1)") is None
    assert validate_and_canonicalize_url("data:text/html,<script>alert(1)</script>") is None
    assert validate_and_canonicalize_url("ftp://example.com/file") is None
    assert validate_and_canonicalize_url("https://localhost/news") is None

    res = validate_and_canonicalize_url("https://www.Reuters.com/markets/fx/?utm_source=rss&b=2&a=1#frag")
    assert res is not None
    clean_url, canonical_url, host = res
    assert host == "reuters.com"
    assert "#frag" not in clean_url
    assert canonical_url == "https://reuters.com/markets/fx?a=1&b=2"


def test_sanitize_text_strips_html_and_scripts():
    dirty = '<b>Breaking:</b> <script>evil()</script> CPI rises &amp; yields jump\x00!'
    cleaned = sanitize_text(dirty)
    assert "<script>" not in cleaned
    assert "<b>" not in cleaned
    assert "\x00" not in cleaned
    assert "CPI rises & yields jump" in cleaned


def test_contextual_instrument_matching_avoids_false_positives():
    # Bare 2-letter words "es", "cl", "gc" in ordinary sentences must NOT match futures symbols
    syms, src = extract_symbols(
        "Spanish banks report Q3 results as es expected in Madrid and cl credit lines expand",
        "Olympic swimmer wins gold medal in Paris event.",
    )
    assert "ES" not in syms
    assert "CL" not in syms
    assert "XAU/USD" not in syms
    assert src == "none"

    # Explicit financial context phrases MUST match accurately
    syms2, src2 = extract_symbols(
        "EUR/USD and Bitcoin rally as S&P 500 hits record and WTI crude oil futures climb",
        "Spot gold XAUUSD also gained.",
    )
    assert src2 == "contextual"
    assert "EUR/USD" in syms2
    assert "BTC/USD" in syms2
    assert "SPY" in syms2
    assert "CL" in syms2
    assert "XAU/USD" in syms2


def test_category_classification_and_relevance():
    assert classify_category("Federal Reserve FOMC minutes point to steady policy") == "central_banks"
    assert classify_category("EUR/USD breaks above 1.0950 in London forex trading") == "forex"
    assert classify_category("Bitcoin and Ethereum rally as spot crypto ETF inflows surge") == "crypto"
    assert classify_category("WTI crude oil and spot gold prices rise on Middle East tensions") == "commodities"
    assert classify_category("US CPI inflation eases to 2.4% while nonfarm payrolls beat") == "economy"
    assert classify_category("S&P 500 and Nasdaq 100 close at fresh highs") == "indices"
    assert classify_category("Apple shares jump after quarterly earnings beat Wall Street estimates") == "stocks"
    assert not is_financially_relevant("Local high school football team wins championship", None, [])


def test_deduplication_merges_marketaux_sentiment_and_rss_summary():
    rss_raw = parse_google_rss_xml(SAMPLE_RSS_XML)[0]
    gdelt_raw = parse_gdelt_json(SAMPLE_GDELT_JSON)[1]
    mkt_raw = parse_marketaux_json(SAMPLE_MARKETAUX_JSON)[0]

    norm_list = [
        normalize_raw_article(rss_raw),
        normalize_raw_article(gdelt_raw),
        normalize_raw_article(mkt_raw),
    ]
    valid = [n for n in norm_list if n is not None]
    assert len(valid) == 3

    deduped = deduplicate_articles(valid)
    assert len(deduped) == 1
    merged = deduped[0]
    assert merged.sentiment == "positive"
    assert merged.sentiment_score == pytest.approx(0.62)
    assert "EUR/USD" in merged.symbols
    assert merged.symbols_source == "provider"
    assert merged.summary is not None


def test_two_tier_cache_key_separation():
    k_prov_fx = provider_cache_key("google_rss", "forex query")
    k_prov_crypto = provider_cache_key("google_rss", "crypto query")
    assert k_prov_fx != k_prov_crypto

    # GDELT uses a shared macro query across standard tabs when no user search query is set,
    # so switching categories reuses the cached GDELT upstream pool without hitting 5.5s rate limit
    from app.services.news.providers.gdelt import build_gdelt_query

    q_fx = build_gdelt_query("forex", None)
    q_eco = build_gdelt_query("economy", None)
    assert provider_cache_key("gdelt", q_fx) == provider_cache_key("gdelt", q_eco)

    # Custom user searches produce distinct upstream keys
    q_search = build_gdelt_query("forex", "Lagarde")
    assert provider_cache_key("gdelt", q_search) != provider_cache_key("gdelt", q_fx)

    # Candidate pool cache keys are strictly separated by category
    p_fx = pool_cache_key("forex", None, ("google_rss", "gdelt"))
    p_crypto = pool_cache_key("crypto", None, ("google_rss", "gdelt"))
    assert p_fx != p_crypto


def test_gdelt_pacing_guard_prevents_rapid_upstream_calls(monkeypatch):
    calls = {"n": 0}

    class FakeResp:
        status_code = 200
        text = '{"articles": []}'

        def raise_for_status(self):
            pass

        def json(self):
            return SAMPLE_GDELT_JSON

    class FakeClient:
        def get(self, *args, **kwargs):
            calls["n"] += 1
            return FakeResp()

        def close(self):
            pass

    first = fetch_gdelt_doc("all", "query-one", force_refresh=True, client=FakeClient())
    assert first.status == "ok"
    assert calls["n"] == 1

    # Immediate second call with a different query within 5.5s is paced without firing an upstream HTTP request
    second = fetch_gdelt_doc("all", "query-two", force_refresh=True, client=FakeClient())
    assert calls["n"] == 1
    assert second.status in {"rate_limited", "cached"}


def test_marketaux_daily_quota_guard_and_token_redaction(monkeypatch):
    monkeypatch.setattr(settings, "marketaux_api_token", "secret-token-xyz")
    monkeypatch.setattr(settings, "marketaux_daily_quota", 2)

    calls = {"n": 0}

    class FakeResp:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return SAMPLE_MARKETAUX_JSON

    class FakeClient:
        def get(self, *args, **kwargs):
            calls["n"] += 1
            return FakeResp()

    r1 = fetch_marketaux("forex", force_refresh=True, client=FakeClient())
    r2 = fetch_marketaux("crypto", force_refresh=True, client=FakeClient())
    r3 = fetch_marketaux("stocks", force_refresh=True, client=FakeClient())

    assert r1.status == "ok"
    assert r2.status == "ok"
    assert r3.status == "quota_exhausted"
    assert calls["n"] == 2
    assert get_marketaux_quota_used() == 2
    assert "secret-token-xyz" not in (r3.detail or "")


def test_partial_provider_failure_and_stale_fallback(monkeypatch):
    rss_articles = parse_google_rss_xml(SAMPLE_RSS_XML)

    monkeypatch.setattr(
        "app.services.news.service.fetch_marketaux",
        lambda *a, **kw: ProviderFetchResult(
            provider="marketaux", enabled=False, healthy=False, status="unconfigured"
        ),
    )
    monkeypatch.setattr(
        "app.services.news.service.fetch_google_rss",
        lambda *a, **kw: ProviderFetchResult(
            provider="google_rss", enabled=True, healthy=True, status="ok", articles=rss_articles
        ),
    )
    monkeypatch.setattr(
        "app.services.news.service.fetch_gdelt_doc",
        lambda *a, **kw: ProviderFetchResult(
            provider="gdelt", enabled=True, healthy=False, status="error", detail="GDELT timeout"
        ),
    )

    pool, freshness = load_candidate_pool("all")
    assert freshness == "latest"
    assert len(pool.articles) == 2
    assert "google_rss" in pool.active_providers

    # Now simulate total outage across all providers — should fall back to stale cache
    monkeypatch.setattr(
        "app.services.news.service.fetch_google_rss",
        lambda *a, **kw: ProviderFetchResult(
            provider="google_rss", enabled=True, healthy=False, status="error", detail="Offline"
        ),
    )
    stale_pool, stale_freshness = load_candidate_pool("all", force_refresh=True)
    assert stale_freshness == "stale"
    assert len(stale_pool.articles) == 2

    # If cache is cold and all providers fail, raise 503
    cache_store.reset()
    with pytest.raises(HTTPException) as exc:
        load_candidate_pool("all", force_refresh=True)
    assert exc.value.status_code == 503


def test_featured_story_selected_from_filtered_pool():
    raw_items = parse_google_rss_xml(SAMPLE_RSS_XML) + parse_marketaux_json(SAMPLE_MARKETAUX_JSON)
    norm = deduplicate_articles([n for n in (normalize_raw_article(r) for r in raw_items) if n is not None])

    forex_only = [a for a in norm if a.category == "forex"]
    crypto_only = [a for a in norm if a.category == "crypto"]

    feat_fx = select_featured_article(forex_only)
    feat_crypto = select_featured_article(crypto_only)

    assert feat_fx is not None and feat_fx.category == "forex"
    assert feat_crypto is not None and feat_crypto.category == "crypto"
    assert feat_fx.id != feat_crypto.id


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_NEWS_SMOKE") != "1",
    reason="Opt-in live upstream smoke test (set RUN_LIVE_NEWS_SMOKE=1 to run)",
)
def test_live_google_rss_smoke():
    res = fetch_google_rss("forex", force_refresh=True)
    assert res.status == "ok"
    assert len(res.articles) > 0
