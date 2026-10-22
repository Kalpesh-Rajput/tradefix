"""Contextual financial category and instrument classifier.

Prevents false-positive symbol matches on short English words (e.g., "es", "cl", "gc")
by requiring either explicit multi-character pair syntax (EUR/USD, BTCUSD),
provider-verified entity metadata, explicit ticker syntax ($AAPL, NASDAQ: NVDA),
or unambiguous financial context phrases ("S&P 500", "WTI crude", "Apple Inc").
"""

from __future__ import annotations

import re
from typing import Sequence

from app.schemas.news import NewsCategory, NewsSymbolsSource

ALL_CATEGORIES: tuple[NewsCategory, ...] = (
    "all",
    "forex",
    "crypto",
    "stocks",
    "indices",
    "commodities",
    "economy",
    "central_banks",
)

# Explicit multi-char pairs: safe to match on word boundaries (with or without slash/hyphen)
_PAIR_PATTERNS: tuple[tuple[str, re.Pattern[str], NewsCategory], ...] = (
    ("EUR/USD", re.compile(r"\bEUR[/\-]?USD\b", re.IGNORECASE), "forex"),
    ("GBP/USD", re.compile(r"\bGBP[/\-]?USD\b", re.IGNORECASE), "forex"),
    ("USD/JPY", re.compile(r"\bUSD[/\-]?JPY\b", re.IGNORECASE), "forex"),
    ("USD/CHF", re.compile(r"\bUSD[/\-]?CHF\b", re.IGNORECASE), "forex"),
    ("AUD/USD", re.compile(r"\bAUD[/\-]?USD\b", re.IGNORECASE), "forex"),
    ("USD/CAD", re.compile(r"\bUSD[/\-]?CAD\b", re.IGNORECASE), "forex"),
    ("NZD/USD", re.compile(r"\bNZD[/\-]?USD\b", re.IGNORECASE), "forex"),
    ("EUR/GBP", re.compile(r"\bEUR[/\-]?GBP\b", re.IGNORECASE), "forex"),
    ("EUR/JPY", re.compile(r"\bEUR[/\-]?JPY\b", re.IGNORECASE), "forex"),
    ("GBP/JPY", re.compile(r"\bGBP[/\-]?JPY\b", re.IGNORECASE), "forex"),
    ("AUD/JPY", re.compile(r"\bAUD[/\-]?JPY\b", re.IGNORECASE), "forex"),
    ("EUR/CHF", re.compile(r"\bEUR[/\-]?CHF\b", re.IGNORECASE), "forex"),
    ("USD/MXN", re.compile(r"\bUSD[/\-]?MXN\b", re.IGNORECASE), "forex"),
    ("DXY", re.compile(r"\b(?:DXY|U\.?S\.?\s+Dollar\s+Index|Dollar\s+Index)\b", re.IGNORECASE), "forex"),
    ("XAU/USD", re.compile(r"\b(?:XAU[/\-]?USD|spot\s+gold|gold\s+futures|gold\s+prices?|bullion)\b", re.IGNORECASE), "commodities"),
    ("XAG/USD", re.compile(r"\b(?:XAG[/\-]?USD|spot\s+silver|silver\s+futures|silver\s+prices?)\b", re.IGNORECASE), "commodities"),
    ("BTC/USD", re.compile(r"\b(?:BTC[/\-]?USD|BTC[/\-]?USDT|Bitcoin)\b", re.IGNORECASE), "crypto"),
    ("ETH/USD", re.compile(r"\b(?:ETH[/\-]?USD|ETH[/\-]?USDT|Ethereum|Ether\s+ETF)\b", re.IGNORECASE), "crypto"),
    ("SOL/USD", re.compile(r"\b(?:SOL[/\-]?USD|SOL[/\-]?USDT|Solana)\b", re.IGNORECASE), "crypto"),
)

# Contextual patterns for instruments whose raw 2-4 letter ticker could collide with prose if not guarded
_CONTEXTUAL_INSTRUMENTS: tuple[tuple[str, re.Pattern[str], NewsCategory], ...] = (
    (
        "CL",
        re.compile(
            r"\b(?:WTI\s+crude|Brent\s+crude|crude\s+oil\s+(?:futures|prices?|inventories|markets?)|NYMEX\s+crude|OPEC\+?)\b",
            re.IGNORECASE,
        ),
        "commodities",
    ),
    (
        "SPY",
        re.compile(r"(?:\bS&P\s*500\b|\$SPY\b|\bSPY\s+ETF\b)", re.IGNORECASE),
        "indices",
    ),
    (
        "QQQ",
        re.compile(r"(?:\bNasdaq[\s\-]*100\b|\bNasdaq\s+Composite\b|\$QQQ\b|\bQQQ\s+ETF\b)", re.IGNORECASE),
        "indices",
    ),
    (
        "AAPL",
        re.compile(r"(?:\$AAPL\b|\bAAPL\s+(?:stock|shares|earnings)\b|\bApple(?:'s|\s+Inc\.?|\s+shares|\s+stock|\s+earnings)\b)", re.IGNORECASE),
        "stocks",
    ),
    (
        "NVDA",
        re.compile(r"(?:\$NVDA\b|\bNVDA\b|\bNvidia(?:'s|\s+Corp|\s+shares|\s+stock|\s+earnings|\s+chips?)?\b)", re.IGNORECASE),
        "stocks",
    ),
    (
        "MSFT",
        re.compile(r"(?:\$MSFT\b|\bMSFT\b|\bMicrosoft(?:'s|\s+Corp|\s+shares|\s+stock|\s+earnings)?\b)", re.IGNORECASE),
        "stocks",
    ),
    (
        "TSLA",
        re.compile(r"(?:\$TSLA\b|\bTSLA\b|\bTesla(?:'s|\s+Inc|\s+shares|\s+stock|\s+earnings|\s+EVs?)?\b)", re.IGNORECASE),
        "stocks",
    ),
    (
        "AMZN",
        re.compile(r"(?:\$AMZN\b|\bAMZN\b|\bAmazon(?:\.com|'s|\s+Inc|\s+shares|\s+stock|\s+AWS|\s+earnings)\b)", re.IGNORECASE),
        "stocks",
    ),
    (
        "META",
        re.compile(r"(?:\$META\b|\bMeta\s+Platforms\b|\bMeta(?:'s)?\s+(?:shares|stock|earnings|AI)\b)", re.IGNORECASE),
        "stocks",
    ),
    (
        "GOOGL",
        re.compile(r"(?:\$GOOGL?\b|\bGOOGL\b|\bAlphabet(?:'s|\s+Inc|\s+shares|\s+stock|\s+earnings)\b|\bGoogle\s+(?:stock|shares|earnings|antitrust|cloud)\b)", re.IGNORECASE),
        "stocks",
    ),
)

# Canonical normalization map for provider-supplied symbols
_PROVIDER_SYMBOL_MAP: dict[str, str] = {
    "EURUSD": "EUR/USD",
    "EUR/USD": "EUR/USD",
    "GBPUSD": "GBP/USD",
    "GBP/USD": "GBP/USD",
    "USDJPY": "USD/JPY",
    "USD/JPY": "USD/JPY",
    "USDCHF": "USD/CHF",
    "USD/CHF": "USD/CHF",
    "AUDUSD": "AUD/USD",
    "AUD/USD": "AUD/USD",
    "USDCAD": "USD/CAD",
    "USD/CAD": "USD/CAD",
    "NZDUSD": "NZD/USD",
    "NZD/USD": "NZD/USD",
    "EURGBP": "EUR/GBP",
    "EURJPY": "EUR/JPY",
    "GBPJPY": "GBP/JPY",
    "AUDJPY": "AUD/JPY",
    "XAUUSD": "XAU/USD",
    "XAU/USD": "XAU/USD",
    "XAGUSD": "XAG/USD",
    "XAG/USD": "XAG/USD",
    "BTC": "BTC/USD",
    "BTCUSD": "BTC/USD",
    "BTC/USD": "BTC/USD",
    "ETH": "ETH/USD",
    "ETHUSD": "ETH/USD",
    "ETH/USD": "ETH/USD",
    "SOL": "SOL/USD",
    "SOLUSD": "SOL/USD",
    "SOL/USD": "SOL/USD",
    "GSPC": "SPY",
    "^GSPC": "SPY",
    "SPX": "SPY",
    "IXIC": "QQQ",
    "^IXIC": "QQQ",
    "NDX": "QQQ",
}

_CATEGORY_RULES: tuple[tuple[NewsCategory, re.Pattern[str]], ...] = (
    (
        "central_banks",
        re.compile(
            r"\b(?:Federal\s+Reserve|FOMC|Jerome\s+Powell|Fed\s+(?:rate|cut|hike|officials?|governor|minutes|chair|policy)|"
            r"European\s+Central\s+Bank|ECB|Christine\s+Lagarde|Bank\s+of\s+England|BoE|Andrew\s+Bailey|"
            r"Bank\s+of\s+Japan|BoJ|Kazuo\s+Ueda|Reserve\s+Bank\s+of\s+Australia|RBA|Swiss\s+National\s+Bank|SNB|"
            r"Bank\s+of\s+Canada|BoC|central\s+bank(?:s|ers)?|monetary\s+policy|rate\s+decision|hawkish|dovish)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "forex",
        re.compile(
            r"\b(?:forex|foreign\s+exchange|currency\s+(?:pair|markets?|traders?)|"
            r"EUR[/\-]?USD|GBP[/\-]?USD|USD[/\-]?JPY|AUD[/\-]?USD|USD[/\-]?CAD|USD[/\-]?CHF|NZD[/\-]?USD|"
            r"EUR[/\-]?GBP|EUR[/\-]?JPY|GBP[/\-]?JPY|dollar\s+index|DXY|greenback|"
            r"yen\s+(?:slides?|falls?|rises?|weakens?|intervention)|sterling\s+(?:rises?|falls?|gains?)|euro\s+zone\s+currency)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "crypto",
        re.compile(
            r"\b(?:cryptocurrenc(?:y|ies)|crypto\s+(?:market|exchange|ETF|regulation|tokens?)|"
            r"Bitcoin|Ethereum|Solana|BTC[/\-]?USD|ETH[/\-]?USD|stablecoin|blockchain|Coinbase|Binance|spot\s+Bitcoin\s+ETF)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "commodities",
        re.compile(
            r"\b(?:commodit(?:y|ies)|XAU[/\-]?USD|XAG[/\-]?USD|spot\s+gold|gold\s+(?:prices?|futures|bullion|rally)|"
            r"silver\s+(?:prices?|futures)|WTI\s+crude|Brent\s+crude|crude\s+oil|OPEC\+?|natural\s+gas\s+futures|copper\s+prices?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "indices",
        re.compile(
            r"\b(?:S&P\s*500|Nasdaq\s+(?:100|Composite)|Dow\s+Jones|DJIA|Russell\s+2000|FTSE\s+100|DAX\s+40|Nikkei\s+225|"
            r"Hang\s+Seng|Stoxx\s+600|VIX\s+index|Wall\s+Street\s+indices|stock\s+index\s+futures)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "economy",
        re.compile(
            r"\b(?:inflation|CPI\s+(?:report|data|print)|consumer\s+price\s+index|PPI|core\s+PCE|"
            r"nonfarm\s+payrolls?|NFP|unemployment\s+rate|jobless\s+claims|GDP\s+growth|gross\s+domestic\s+product|"
            r"retail\s+sales|manufacturing\s+PMI|services\s+PMI|Treasury\s+yields?|bond\s+yields?|10[\s\-]year\s+yield|"
            r"recession|fiscal\s+deficit|tariffs?|trade\s+balance|macroeconomic)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "stocks",
        re.compile(
            r"\b(?:shares|stock\s+market|equit(?:y|ies)|quarterly\s+earnings|EPS\s+beat|revenue\s+guidance|"
            r"IPO|dividend|buyback|Wall\s+Street\s+analysts|NYSE|NASDAQ)\b",
            re.IGNORECASE,
        ),
    ),
)

_FINANCIAL_RELEVANCE_TERMS = re.compile(
    r"\b(?:market|markets|trading|trader|forex|currency|dollar|euro|yen|pound|sterling|"
    r"fed|fomc|ecb|boe|boj|central\s+bank|interest\s+rate|inflation|cpi|gdp|payroll|yield|treasury|"
    r"stock|shares|equity|equities|index|indices|s&p|nasdaq|dow|ftse|nikkei|dax|earnings|revenue|"
    r"crypto|bitcoin|ethereum|solana|etf|gold|silver|crude|oil|opec|commodity|commodities|futures|bond)\b",
    re.IGNORECASE,
)


def normalize_provider_symbol(raw: str) -> str | None:
    cleaned = (raw or "").strip().upper()
    if not cleaned:
        return None
    if cleaned in _PROVIDER_SYMBOL_MAP:
        return _PROVIDER_SYMBOL_MAP[cleaned]
    # Keep standard upper-case tickers (2-10 alphanumeric/slash chars) when supplied by provider entity extraction
    if re.fullmatch(r"[A-Z0-9]{2,6}(?:/[A-Z]{3})?", cleaned):
        return cleaned
    return None


def extract_symbols(
    title: str,
    summary: str | None = None,
    provider_symbols: Sequence[str] | None = None,
) -> tuple[list[str], NewsSymbolsSource]:
    """Return (deduplicated_symbols, symbols_source) with strict contextual matching."""
    text = f"{title} {summary or ''}".strip()
    verified: list[str] = []
    if provider_symbols:
        for raw in provider_symbols:
            norm = normalize_provider_symbol(raw)
            if norm and norm not in verified:
                verified.append(norm)

    contextual: list[str] = []
    for symbol, pattern, _cat in _PAIR_PATTERNS:
        if pattern.search(text) and symbol not in verified and symbol not in contextual:
            contextual.append(symbol)

    for symbol, pattern, _cat in _CONTEXTUAL_INSTRUMENTS:
        if pattern.search(text) and symbol not in verified and symbol not in contextual:
            contextual.append(symbol)

    combined = [*verified, *contextual][:8]
    if verified:
        return combined, "provider"
    if contextual:
        return combined, "contextual"
    return [], "none"


_FX_SYMBOLS = frozenset(
    {
        "EUR/USD",
        "GBP/USD",
        "USD/JPY",
        "USD/CHF",
        "AUD/USD",
        "USD/CAD",
        "NZD/USD",
        "EUR/GBP",
        "EUR/JPY",
        "GBP/JPY",
        "AUD/JPY",
        "EUR/CHF",
        "USD/MXN",
        "DXY",
    }
)


def classify_category(
    title: str,
    summary: str | None = None,
    symbols: Sequence[str] = (),
    provider_entity_types: Sequence[str] = (),
    hint_category: NewsCategory | None = None,
) -> NewsCategory:
    text = f"{title} {summary or ''}".strip()

    # Check high-specificity regex rules first (Central Banks, Forex, Crypto, Commodities, Indices, Economy, Stocks)
    scores: dict[NewsCategory, int] = {}
    for cat, pattern in _CATEGORY_RULES:
        matches = pattern.findall(text)
        if matches:
            title_matches = pattern.findall(title)
            scores[cat] = len(matches) + len(title_matches) * 2

    # When an explicit FX currency pair is in the headline, boost forex so it matches traders' FX filter expectations
    if any(sym in _FX_SYMBOLS for sym in symbols) and any(
        p.search(title) for sym_id, p, c in _PAIR_PATTERNS if c == "forex"
    ):
        scores["forex"] = scores.get("forex", 0) + 4

    if scores:
        best_cat = max(scores.keys(), key=lambda c: scores[c])
        return best_cat

    # Symbol-based fallback
    for sym in symbols:
        if sym in {"EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD", "EUR/GBP", "EUR/JPY", "GBP/JPY", "DXY"}:
            return "forex"
        if sym in {"BTC/USD", "ETH/USD", "SOL/USD"}:
            return "crypto"
        if sym in {"XAU/USD", "XAG/USD", "CL"}:
            return "commodities"
        if sym in {"SPY", "QQQ"}:
            return "indices"
        if sym in {"AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "META", "GOOGL"}:
            return "stocks"

    # Provider entity type fallback
    ent_types = {t.lower() for t in provider_entity_types if t}
    if "cryptocurrency" in ent_types:
        return "crypto"
    if "currency" in ent_types:
        return "forex"
    if "index" in ent_types:
        return "indices"
    if "equity" in ent_types:
        return "stocks"

    if hint_category and hint_category != "all":
        return hint_category

    return "economy"


def compute_relevance_score(
    title: str,
    summary: str | None,
    symbols: Sequence[str],
    category: NewsCategory,
    search_query: str | None = None,
) -> float:
    text = f"{title} {summary or ''}"
    term_hits = len(_FINANCIAL_RELEVANCE_TERMS.findall(text))
    score = min(5.0, term_hits * 0.6)
    if symbols:
        score += min(3.0, len(symbols) * 1.0)
    if summary and len(summary) >= 40:
        score += 1.0
    if category != "all":
        score += 0.5
    if search_query:
        tokens = [tok.lower() for tok in re.split(r"\s+", search_query.strip()) if len(tok) >= 2]
        title_l = title.lower()
        body_l = text.lower()
        for tok in tokens:
            if tok in title_l:
                score += 3.0
            elif tok in body_l:
                score += 1.2
    return round(score, 2)


def is_financially_relevant(title: str, summary: str | None, symbols: Sequence[str]) -> bool:
    if symbols:
        return True
    text = f"{title} {summary or ''}"
    return bool(_FINANCIAL_RELEVANCE_TERMS.search(text))
