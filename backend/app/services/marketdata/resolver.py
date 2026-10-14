"""Journal symbol -> registry instrument (backtesting/02 sections 3.1 and 3.2; D-011).

Order: alias table (broker-specific, then the "*" wildcard), built-in generic aliases, then broker
decoration and separator rules, then crypto perpetual naming. Anything left is counted in
`unresolved_symbols`. Time handling lives in `time_offsets` (Phase 2A), not here.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Iterable

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.market_data import SymbolAlias, UnresolvedSymbol
from app.services.marketdata.registry import InstrumentSpec, get_instrument

ANY_BROKER = "*"
BINANCE_PROXY_BROKERS = frozenset({"bybit", "okx", "bitget", "kucoin", "mexc", "gateio", "delta"})

GENERIC_ALIASES: dict[str, str] = {
    "GOLD": "XAUUSD",
    "SILVER": "XAGUSD",
    "SPX500": "US500",
    "SP500": "US500",
    "SPX": "US500",
    "USA500": "US500",
    "USTEC": "US100",
    "NAS100": "US100",
    "NSDQ100": "US100",
    "NDX100": "US100",
    "USTECH100": "US100",
    "USTECH": "US100",
    "DJ30": "US30",
    "DOW30": "US30",
    "WS30": "US30",
    "DJI30": "US30",
    "USA30": "US30",
    "GER40": "DE40",
    "GER30": "DE40",
    "DE30": "DE40",
    "DAX40": "DE40",
    "DAX": "DE40",
}

_SUFFIXES = (
    ".CASH", ".PRO", ".RAW", ".ECN", ".STD", ".VIP", ".MICRO", "-ECN", "_SB", ".SB",
    ".M", ".A", ".B", ".C", ".I", ".R", ".X", "M", "#", "+", "!", ".", "-", "_",
)
_PREFIXES = ("#", ".", "_")
_SEPARATORS = re.compile(r"[/_\-\s.:]")
_PERPETUAL = (
    re.compile(r"^(?P<base>[A-Z0-9]+)/USDT:USDT$"),
    re.compile(r"^(?P<base>[A-Z0-9]+)-USDT-SWAP$"),
    re.compile(r"^(?P<base>[A-Z0-9]+)[-_]?USDT[-_.]?(?:P|PERP|PERPETUAL|SWAP)$"),
    re.compile(r"^(?P<base>[A-Z0-9]+)[-_]?USD[-_.]?(?:PERP|PERPETUAL|SWAP)$"),
    re.compile(r"^(?P<base>[A-Z0-9]+)-PERP$"),
)
_PERP_MARKETS = {"futures", "usdm_futures", "perp", "perpetual", "swap", "linear"}


@dataclass(frozen=True)
class Resolution:
    raw_symbol: str
    broker: str
    instrument: InstrumentSpec | None
    method: str
    price_note: str | None = None

    @property
    def resolved(self) -> bool:
        return self.instrument is not None

    @property
    def symbol(self) -> str | None:
        return self.instrument.symbol if self.instrument else None


def normalize_broker(broker: str | None) -> str:
    """'api:binance', 'Binance', ' BINANCE ' -> 'binance'."""
    value = (broker or "").strip().lower()
    if value.startswith("api:"):
        value = value[4:]
    return value or "unknown"


def _strip_decorations(symbol: str) -> Iterable[str]:
    current = symbol
    for _ in range(3):
        for prefix in _PREFIXES:
            if current.startswith(prefix):
                current = current[len(prefix):]
                yield current
        changed = False
        for suffix in _SUFFIXES:
            if len(current) > len(suffix) + 2 and current.endswith(suffix):
                yield current[: -len(suffix)]
                current = current[: -len(suffix)]
                changed = True
                break
        if not changed:
            return


def _perpetual(symbol: str) -> str | None:
    for pattern in _PERPETUAL:
        match = pattern.match(symbol)
        if match:
            return f"{match.group('base')}USDT_PERP"
    return None


def candidate_symbols(raw: str) -> list[tuple[str, str]]:
    """(candidate canonical, rule) pairs in priority order. Exposed for tests and the unresolved report."""
    upper = (raw or "").strip().upper()
    if not upper:
        return []
    out: list[tuple[str, str]] = [(upper, "exact")]
    perp = _perpetual(upper)
    if perp:
        out.append((perp, "perpetual"))
    for stripped in _strip_decorations(upper):
        out.append((stripped, "suffix"))
    for value in [upper, *(s for s, _ in out)]:
        joined = _SEPARATORS.sub("", value)
        if joined != value:
            out.append((joined, "separator"))
    for value, _ in list(out):
        if value in GENERIC_ALIASES:
            out.append((GENERIC_ALIASES[value], "generic_alias"))
        if value.endswith("USD") and not value.endswith("USDT") and len(value) > 3:
            out.append((value + "T", "crypto_usd"))
    seen: set[str] = set()
    return [(c, r) for c, r in out if not (c in seen or seen.add(c))]


def _alias(db: Session, broker: str, raw: str) -> str | None:
    rows = db.execute(
        select(SymbolAlias.broker, SymbolAlias.canonical_symbol).where(
            SymbolAlias.broker.in_([broker, ANY_BROKER]), func.upper(SymbolAlias.raw_symbol) == raw.strip().upper()
        )
    ).all()
    by_broker = {b: c for b, c in rows}
    return by_broker.get(broker) or by_broker.get(ANY_BROKER)


def _apply_market(spec: InstrumentSpec, market_type: str | None, lookup: Callable[[str], InstrumentSpec | None]) -> InstrumentSpec:
    if spec.asset_class != "crypto" or (market_type or "").lower() not in _PERP_MARKETS or spec.symbol.endswith("_PERP"):
        return spec
    return lookup(f"{spec.symbol}_PERP") or spec


def record_unresolved(db: Session, broker: str, raw: str) -> None:
    table = UnresolvedSymbol.__table__
    stmt = insert(table).values(broker=broker[:64], raw_symbol=raw.strip()[:64], count=1)
    db.execute(
        stmt.on_conflict_do_update(
            constraint="uq_unresolved_broker_raw",
            set_={"count": table.c.count + 1, "last_seen": func.now()},
        )
    )


def record_interest(db: Session, broker: str | None, raw: str) -> None:
    """A user asked for replay support for a symbol; counted separately from automatic misses."""
    table = UnresolvedSymbol.__table__
    stmt = insert(table).values(broker=normalize_broker(broker)[:64], raw_symbol=raw.strip()[:64], count=0, interest_count=1)
    db.execute(
        stmt.on_conflict_do_update(
            constraint="uq_unresolved_broker_raw",
            set_={"interest_count": table.c.interest_count + 1, "last_seen": func.now()},
        )
    )


def resolve_symbol(
    db: Session,
    broker: str | None,
    raw_symbol: str,
    *,
    market_type: str | None = None,
    record: bool = True,
    lookup: Callable[[str], InstrumentSpec | None] = get_instrument,
) -> Resolution:
    broker_key = normalize_broker(broker)
    raw = (raw_symbol or "").strip()
    spec: InstrumentSpec | None = None
    method = "unresolved"
    aliased = _alias(db, broker_key, raw) if raw else None
    if aliased:
        spec, method = lookup(aliased), "alias"
    if spec is None:
        for candidate, rule in candidate_symbols(raw):
            spec = lookup(candidate)
            if spec is not None:
                method = rule
                break
    if spec is None:
        if record and raw:
            record_unresolved(db, broker_key, raw)
        return Resolution(raw, broker_key, None, "unresolved")
    spec = _apply_market(spec, market_type, lookup)
    note = "binance_proxy" if spec.source == "binance" and broker_key in BINANCE_PROXY_BROKERS else None
    return Resolution(raw, broker_key, spec, method, note)


def add_alias(db: Session, broker: str, raw_symbol: str, canonical: str, created_by: str | None = None) -> SymbolAlias:
    spec = get_instrument(canonical)
    if spec is None:
        raise ValueError(f"unknown instrument {canonical}")
    broker_key = ANY_BROKER if broker == ANY_BROKER else normalize_broker(broker)
    raw = raw_symbol.strip()
    row = db.scalar(select(SymbolAlias).where(SymbolAlias.broker == broker_key, SymbolAlias.raw_symbol == raw))
    if row is None:
        row = SymbolAlias(broker=broker_key, raw_symbol=raw, canonical_symbol=spec.symbol, created_by=created_by)
        db.add(row)
    else:
        row.canonical_symbol = spec.symbol
    db.flush()
    return row


def unresolved_report(db: Session, limit: int = 50) -> list[UnresolvedSymbol]:
    return list(
        db.scalars(
            select(UnresolvedSymbol)
            .order_by(UnresolvedSymbol.count.desc(), UnresolvedSymbol.interest_count.desc())
            .limit(limit)
        )
    )
