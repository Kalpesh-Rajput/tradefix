# TradeFix Financial News Terminal — Architecture & Implementation Guide

## 1. Overview

The TradeFix Financial News Terminal (`/news`) replaces the static placeholder page with a full-stack, data-driven market intelligence workspace tailored for active Forex, Crypto, Equity, Index, Commodity, and Macroeconomic traders.

It follows TradeFix's production architecture:
- **Backend:** FastAPI (`/api/news` and `/api/news/bookmarks`), SQLAlchemy 2.0, PostgreSQL (`news_bookmarks` table via Alembic migration `0042`), Pydantic v2 schemas, `httpx` upstream adapters, and thread-safe two-tier TTL + stale-fallback caching.
- **Frontend:** Next.js 16.3.8 App Router (`frontend/app/(app)/news/page.tsx`), TanStack Query hooks (`frontend/lib/hooks/useNews.ts`), and modular workspace components (`frontend/components/news/`).

---

## 2. Financial News Provider Evaluation & Selection

Five candidate sources were evaluated against their official documentation:

| Provider | Free Tier Availability | Coverage & Metadata | Key Limits & Constraints | Decision |
| :--- | :--- | :--- | :--- | :--- |
| **A. Marketaux** (`https://api.marketaux.com/v1/news/all`) | Yes (`$0/mo` Free plan) | 5,000+ sources, 80+ markets; entity extraction (`equity`, `index`, `etf`, `currency`, `cryptocurrency`), per-entity `sentiment_score` (`-1` to `+1`), snippet, description, UTC `published_at`. | **100 requests/day**, **3 articles per request** on the Free tier. Requires `MARKETAUX_API_TOKEN`. | **Selected (Optional Enrichment Adapter)** — Automatically enabled when `MARKETAUX_API_TOKEN` is configured to supply verified entity tickers and provider-computed sentiment. |
| **B. iTick** (`https://api.itick.org/news`) | Token required; institutional focus | Title, publish timestamp, market type, link, provider name. | List endpoint omits article summaries/excerpts and sentiment; free samples are heavily regional (HK/CN). | **Rejected** |
| **C. GDELT DOC 2.0** (`https://api.gdeltproject.org/api/v2/doc/doc`) | Yes (100% open, no API key) | Global news across 65 languages (`sourcelang:eng` filter supported); returns up to 250 articles per query in `ArtList` JSON mode with `title`, `url`, `domain`, `seendate` (UTC), `language`, `sourcecountry`. | Upstream enforces **1 request per 5 seconds**. `ArtList` JSON does not include body excerpts or ticker tags. | **Selected (Secondary Keyless Macro/Global Adapter)** — Paced with a 5.5s minimum interval guard and shared macro upstream query cache. |
| **D. Alpha Vantage** (`NEWS_SENTIMENT`) | **No** (Marked *"Market News & Sentiment Trending Premium"*) | Tickers (`FOREX:USD`, `CRYPTO:BTC`, equities), topics, sentiment scores. | Official docs state `NEWS_SENTIMENT` is a paid **Premium** endpoint (`apikey=demo` only serves static sample data). | **Rejected** (Not free) |
| **E. ForexNewsAPI** (`https://forexnewsapi.com`) | **No** (`$9.99/mo` Basic plan) | Currency pair news, sentiment, economic calendar. | Paid subscription required; basic plans capped at 5 pages. | **Rejected** (Not free) |
| **Google News Financial RSS** (`https://news.google.com/rss/search`) | Yes (Public RSS, no API key, already used in `app/services/ai/tools/web.py`) | Curated financial queries returning headline, original publisher attribution (`<source>`), link, RFC-2822 UTC `pubDate`, and short description snippet. | Does not include structured ticker tags or sentiment scores. | **Selected (Primary Keyless Financial Adapter)** — Works out-of-the-box with zero API keys. |

### Isolated Provider Adapter Architecture
Each upstream source is implemented as an isolated adapter in `backend/app/services/news/providers/`:
1. **`GoogleNewsRssAdapter` (`google_rss`)** — Controlled by `NEWS_GOOGLE_RSS_ENABLED=true`. Fetches targeted financial RSS feeds per category/search query with independent timeout and XML sanitization.
2. **`GdeltDocAdapter` (`gdelt`)** — Controlled by `NEWS_GDELT_ENABLED=true`. Queries GDELT DOC 2.0 `ArtList` JSON endpoint with a strict 5.5s minimum interval guard (`NEWS_GDELT_MIN_INTERVAL_SECONDS=5.5`) and shared macro upstream query caching so category tab switches reuse cached GDELT responses without triggering upstream rate limits.
3. **`MarketauxAdapter` (`marketaux`)** — Controlled by `NEWS_MARKETAUX_ENABLED=true` and active when `MARKETAUX_API_TOKEN` is set. Enriches the candidate pool with provider-verified entity symbols and sentiment scores (`positive`, `negative`, `neutral`), protected by a configurable daily quota guard (`MARKETAUX_DAILY_QUOTA=95`).

If any adapter times out, hits a rate limit, or is disabled, the service logs a warning (never exposing API tokens) and serves normalized articles from the remaining healthy provider(s).

---

## 3. Licensing, Attribution, and Commercial-Use Considerations

- **Headline & Link-Out Model Only:** TradeFix never scrapes, stores, or republishes full article bodies, nor does it bypass publisher paywalls. Every card displays explicit publisher attribution (`source`) and opens the original article URL in a new tab with `target="_blank" rel="noopener noreferrer"`.
- **Thumbnail Hotlinking Disabled by Default:** To respect publisher bandwidth and copyright, third-party image hotlinking is disabled by default (`NEWS_ENABLE_THUMBNAILS=false`) in favor of a clean, institutional text-first card layout.
- **Provider Terms:**
  - **Google News RSS:** Publicly accessible RSS feeds are used strictly for headline discovery and direct link-out attribution to original publishers. Commercial redistribution or syndication of full content requires separate publisher licensing.
  - **GDELT Project:** GDELT metadata is open data for research and application integration with citation to The GDELT Project; linked articles remain copyright of their respective publishers.
  - **Marketaux:** Usage of the Free plan (`100 requests/day`, `3 articles/request`) is governed by Marketaux Terms of Service.

---

## 4. Two-Tier Caching, Rate-Limit Strategy & Topology

### Deployment Topology
- TradeFix does **not** use Redis (`backend/requirements.txt`).
- Both local development (`scripts/dev.py` / `uvicorn app.main:app`) and production on **Render** (`DEPLOY.md`: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`) run as a single Uvicorn worker process connected to **Neon PostgreSQL**.
- **Multi-Worker Limitation Note:** Because caching, single-flight request locks, GDELT 5.5s pacing, and the Marketaux daily quota counter (`marketaux_daily_quota`) are held in process memory, they are exact for the standard single-worker Render deployment, reset on process restart, and would be per-worker if scaled horizontally to multiple Uvicorn workers without introducing Redis or a shared DB counter.

### Two-Tier Cache Key Strategy (`backend/app/services/news/cache.py`)
1. **Upstream Provider Cache (`provider_cache_key(provider_id, upstream_query_signature)`):**
   - Keyed by `(provider_id, normalized_upstream_query)`.
   - Caches parsed provider responses for `NEWS_CACHE_TTL_SECONDS` (default `300s` / 5 minutes).
   - Standard GDELT category tabs share a broad macro/markets query signature so switching categories reuses the cached GDELT pool without waiting on the 5.5s GDELT rate limit, while custom search queries produce distinct upstream keys.
2. **Candidate Pool Cache (`pool_cache_key(category, normalized_search_query, enabled_providers_signature)`):**
   - Aggregates articles across enabled providers, normalizes timestamps to UTC, deduplicates across providers, and runs contextual classification.
   - Guarded by a per-key single-flight lock so concurrent requests wait on the in-flight fetch rather than causing an upstream request storm.
   - Maintains a `_last_good` fallback snapshot: if all upstream providers fail on refresh, cached articles are served with `freshness="stale"`.

---

## 5. Contextual Instrument Matching & Honest Sentiment

- **Contextual Classifier (`backend/app/services/news/classifier.py`):**
  - Explicit currency/crypto/metal pairs (`EUR/USD`, `GBP/USD`, `USD/JPY`, `AUD/USD`, `USD/CAD`, `USD/CHF`, `NZD/USD`, `XAU/USD`, `XAG/USD`, `BTC/USD`, `ETH/USD`, `SOL/USD`, `DXY`) match on word boundaries.
  - Short or ambiguous symbols (`CL`, `SPY`, `QQQ`, `AAPL`, `NVDA`, `MSFT`, `TSLA`, `AMZN`, `META`, `GOOGL`) require either:
    1. Provider-supplied entity metadata (`Marketaux`), OR
    2. Unambiguous financial context phrases (`"S&P 500"`, `"Nasdaq 100"`, `"WTI crude"`, `"crude oil futures"`, `"spot gold"`, `"Apple shares"`, `"Nvidia"`, `"Microsoft"`, `"Tesla"`) or explicit ticker notation (`$AAPL`).
  - Bare prose words like `"es"`, `"cl"`, or `"gold medal"` never trigger false-positive instrument tags.
- **Sentiment Integrity:**
  - `sentiment` (`"positive" | "negative" | "neutral" | None`) is **only** populated when supplied by an upstream provider with native sentiment analysis (`Marketaux`). Heuristic keyword sentiment is never fabricated.

---

## 6. Files Created and Modified

### Created
- `NEWS_IMPLEMENTATION.md` — Architecture, provider evaluation, API contracts, licensing, and deployment documentation.
- `backend/app/models/news_bookmark.py` — `NewsBookmark` SQLAlchemy model (`news_bookmarks` table with `(user_id, article_id)` uniqueness constraint).
- `backend/alembic/versions/0042_news_bookmarks.py` — Additive Alembic migration revising `0041`.
- `backend/app/schemas/news.py` — Pydantic v2 schemas for articles, feed responses, provider health, and bookmarks.
- `backend/app/services/news/__init__.py` — Service package exports.
- `backend/app/services/news/types.py` — Internal dataclasses (`RawProviderArticle`, `NormalizedArticle`, `ProviderFetchResult`).
- `backend/app/services/news/classifier.py` — Contextual category and instrument classifier.
- `backend/app/services/news/normalizer.py` — UTC timestamp parser, HTML/script sanitizer, URL canonicalizer, and cross-provider deduplicator.
- `backend/app/services/news/cache.py` — Thread-safe two-tier provider and candidate pool cache with single-flight locks and stale fallback.
- `backend/app/services/news/providers/__init__.py` — Provider adapter exports.
- `backend/app/services/news/providers/google_rss.py` — Isolated Google News Financial RSS adapter.
- `backend/app/services/news/providers/gdelt.py` — Isolated GDELT DOC 2.0 adapter with 5.5s pacing guard.
- `backend/app/services/news/providers/marketaux.py` — Optional Marketaux enrichment adapter with daily quota guard.
- `backend/app/services/news/service.py` — Core orchestration, filtering, featured story selection, and bookmark CRUD.
- `backend/app/api/routers/news.py` — Authenticated `/api/news` and `/api/news/bookmarks` endpoints.
- `backend/tests/test_news_service.py` — Unit tests for adapters, normalizer, classifier, deduplicator, cache keys, pacing, and quotas.
- `backend/tests/test_news_api.py` — Integration tests for `/api/news`, bookmark user isolation, URL validation, and migration `0042` round-trip.
- `frontend/lib/news/types.ts` — Frontend TypeScript interfaces and category/instrument constants.
- `frontend/lib/news/format.ts` — Query builder, URL validator, relative/exact timestamp formatters, and pagination deduplicator.
- `frontend/lib/hooks/useNews.ts` — TanStack Query hooks (`useNewsFeed`, `useNewsBookmarks`, `useToggleNewsBookmark`).
- `frontend/components/news/NewsCategoryTabs.tsx` — Category tabs, watchlist/instrument chips, and Saved stories toggle.
- `frontend/components/news/NewsFilterToolbar.tsx` — Debounced search, date range, source, sentiment, and sort controls.
- `frontend/components/news/FeaturedStoryCard.tsx` — Featured story highlight card.
- `frontend/components/news/NewsArticleCard.tsx` — Compact, scannable financial news card.
- `frontend/components/news/NewsArticleDrawer.tsx` — Right-hand slide-over drawer showing the story summary, related instruments, publisher attribution, related stories in the feed, and an "Open Full Article in New Tab" CTA.
- `frontend/components/news/NewsTerminalWorkspace.tsx` — Main News Terminal workspace with loading, empty, stale, partial-degraded, and error states.
- `frontend/scripts/test-news.ts` — Frontend unit test suite.

### Modified
- `backend/app/core/config.py` — Added `news_*`, `marketaux_*`, and `gdelt_*` settings.
- `backend/.env.example` — Documented all new settings (verified by `test_env_example.py`).
- `backend/app/models/user.py` — Added `news_bookmarks` relationship on `User`.
- `backend/app/models/__init__.py` — Registered `NewsBookmark`.
- `backend/app/services/rate_limit.py` — Added `news_refresh_limiter` and `news_bookmark_limiter`.
- `backend/app/main.py` — Included `news.router`.
- `frontend/app/(app)/layout.tsx` — Added `isNews` to workspace layout routes.
- `frontend/app/(app)/news/page.tsx` — Wired `NewsTerminalWorkspace`.
- `frontend/package.json` — Added `test:news` script and included it in `npm test`.

---

## 7. Verification & Test Results

- **Alembic Migration (`0041 -> 0042` + downgrade/upgrade round-trip):** Passed (`alembic upgrade head` and `test_migration_0042_upgrade_downgrade_roundtrip`).
- **Backend Automated Pytest Suite:**
  - `pytest tests/test_env_example.py tests/test_news_service.py tests/test_news_api.py -v` -> **17 passed, 1 skipped** (live smoke test opt-in).
  - Opt-in live upstream smoke test (`RUN_LIVE_NEWS_SMOKE=1 pytest tests/test_news_service.py -k test_live_google_rss_smoke`) -> **1 passed**.
- **Frontend Unit Tests:**
  - `npx --yes tsx scripts/test-news.ts` -> **25 passed, 0 failed**.
- **Frontend TypeScript & Production Build:**
  - `npm run typecheck` (`tsc --noEmit`) -> **Passed (0 errors)**.
  - `npm run build` (`next build` on Next.js 16.3.8) -> **Passed** (`/news` and all 51 routes compiled cleanly).
  - Note on `npm run lint`: Next.js 16.3.8 CLI removed the legacy `next lint` subcommand in `package.json`; IDE/TypeScript diagnostics (`ReadLints` and `tsc --noEmit`) were run across all created and modified files with **0 linter errors**.

---

## 8. Known Limitations & Deferred Features

- **Market Overview Price Strip Omitted by Design:** Because TradeFix does not have a live multi-asset price feed (only delayed daily ECB FX rates and historical backtest candles), the Market Overview Strip was intentionally omitted rather than displaying fabricated or delayed prices as live market data.
- **In-Memory Cache & Quota Counters:** Upstream caches, GDELT 5.5s pacing, and the Marketaux daily quota counter live in process memory (matching the single-worker Uvicorn deployment on Render). Horizontal multi-worker scaling would require Redis or a database-backed counter.
- **Full Article Reader Deferred:** To strictly respect publisher copyright and paywalls, articles open directly on the original publisher's site (`rel="noopener noreferrer"`).
