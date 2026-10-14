"""Decide how an account's stored trade times map to UTC, from price evidence (D-013, D-022, D-023).

A `naive_wall_clock` trade time is a wall clock that was stored as if it were UTC. Each candidate
timezone reinterprets that wall clock; the candidate under which entry prices most often fall inside
the entry-minute 1m candle wins. Detection only reads stored candles and never triggers a fetch.
"""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.account import Account
from app.models.time_offset import AccountTimeOffset
from app.models.trade import Trade
from app.models.user import User
from app.services.live_trades import live_trades
from app.services.marketdata.candles import MINUTE_MS
from app.services.marketdata.coverage import covered_ranges
from app.services.marketdata.registry import InstrumentSpec
from app.services.marketdata.resolver import resolve_symbol
from app.services.marketdata.store import CandleStore, get_store

logger = logging.getLogger(__name__)

NAIVE_BASES = ("naive_wall_clock", "unknown")
SERVER_TIME_PROVIDERS = frozenset({"mt4", "mt5", "xm", "exness", "avatrade"})


def basis_for_input(value: datetime | None) -> str:
    """Write-path rule (AUDIT section 3): an explicit offset is a real instant; a naive value is a wall clock."""
    if value is None:
        return "unknown"
    return "utc_aware" if value.tzinfo is not None and value.utcoffset() is not None else "naive_wall_clock"


def basis_for_provider(provider: str) -> str:
    """Broker sync: MT-style bridges report broker server time as if it were UTC; the others send UTC epochs."""
    return "naive_wall_clock" if provider.lower() in SERVER_TIME_PROVIDERS else "utc_aware"
NY_CLOSE = "NY_CLOSE"
NY_CLOSE_SHIFT = timedelta(hours=7)
METHOD = "price_match_v1"
FORCED_METHOD = "price_match_v1_forced"
MAX_TRADES = 500
_FIXED = re.compile(r"^([+-])(\d{2}):?(\d{2})$")
_NEW_YORK = ZoneInfo("America/New_York")


@dataclass(frozen=True)
class Candidate:
    label: str
    kind: str  # iana | fixed | ny_close
    value: str

    def to_utc(self, wall: datetime) -> datetime:
        """Interpret a naive wall-clock datetime in this candidate's timezone."""
        if self.kind == "ny_close":
            return (wall - NY_CLOSE_SHIFT).replace(tzinfo=_NEW_YORK).astimezone(timezone.utc)
        if self.kind == "fixed":
            sign, hh, mm = _FIXED.match(self.value).groups()
            offset = timedelta(hours=int(hh), minutes=int(mm)) * (1 if sign == "+" else -1)
            return (wall - offset).replace(tzinfo=timezone.utc)
        return wall.replace(tzinfo=ZoneInfo(self.value)).astimezone(timezone.utc)


def parse_candidate(token: str) -> Candidate | None:
    token = token.strip()
    if not token:
        return None
    if token.upper() == NY_CLOSE:
        return Candidate(NY_CLOSE, "ny_close", "America/New_York+7")
    if _FIXED.match(token):
        return Candidate(token, "fixed", token)
    try:
        ZoneInfo(token)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning("ignoring unknown time-offset candidate", extra={"candidate": token})
        return None
    return Candidate(token, "iana", token)


def candidates_for(user_timezone: str | None, extra: str | None = None) -> list[Candidate]:
    """UTC, the profile timezone, common broker server times, then configured extras; deduplicated.

    Order is the tie-break when a sample cannot tell candidates apart (D-030): NY_CLOSE comes before
    the fixed broker offsets it equals for half of each year."""
    tokens = ["UTC", user_timezone or "UTC", NY_CLOSE, "Etc/GMT-2", "Etc/GMT-3"]
    tokens += (extra if extra is not None else settings.time_offset_candidates).split(",")
    out: list[Candidate] = []
    for token in tokens:
        candidate = parse_candidate(token)
        if candidate and candidate.label not in {c.label for c in out}:
            out.append(candidate)
    return out


def candidate_from_row(row: AccountTimeOffset) -> Candidate:
    label = NY_CLOSE if row.tz_kind == "ny_close" else row.tz_value
    return Candidate(label, row.tz_kind, row.tz_value)


def wall_clock(stored: datetime) -> datetime:
    """The naive wall clock a naive-basis trade was saved with (timestamptz kept it as if UTC)."""
    if stored.tzinfo is None:
        return stored
    return stored.astimezone(timezone.utc).replace(tzinfo=None)


def tolerance(spec: InstrumentSpec, price: float) -> float:
    if spec.asset_class in ("forex", "metal"):
        return settings.replay_alignment_tolerance_pips * spec.pip_size
    return abs(price) * settings.replay_alignment_tolerance_pct / 100


@dataclass(frozen=True)
class Sample:
    trade_id: uuid.UUID
    spec: InstrumentSpec
    wall: datetime
    entry_price: float


@dataclass
class Detection:
    best: Candidate
    confidence: str
    match_rate: float
    sample_size: int
    runner_up: Candidate | None
    runner_up_rate: float | None
    scores: dict


def confidence_for(rate: float, margin: float, sample: int, min_sample: int | None = None) -> str:
    if sample < (min_sample or settings.time_offset_min_sample) or rate <= 0:
        return "unknown"
    if rate >= 0.8 and margin >= 0.2 and sample >= 10:
        return "high"
    if rate >= 0.6 and margin >= 0.1:
        return "medium"
    return "low"


def _minute(moment: datetime) -> int:
    ms = int(moment.timestamp() * 1000)
    return ms - ms % MINUTE_MS


def _covered(ranges: list[tuple[int, int]], minute: int) -> bool:
    return any(a <= minute and minute + MINUTE_MS <= b for a, b in ranges)


def score(samples: list[Sample], candidates: list[Candidate], db: Session, store: CandleStore) -> Detection | None:
    """None when no sample has stored candles under every candidate (detection does not run)."""
    coverage: dict[str, list[tuple[int, int]]] = {}
    for sample in samples:
        key = sample.spec.symbol
        if key not in coverage:
            coverage[key] = covered_ranges(db, sample.spec.symbol, sample.spec.source)
    minutes = {c.label: [_minute(c.to_utc(s.wall)) for s in samples] for c in candidates}
    testable = [
        i for i, s in enumerate(samples) if all(_covered(coverage[s.spec.symbol], minutes[c.label][i]) for c in candidates)
    ]
    if not testable:
        return None

    bars: dict[str, dict[int, tuple[float, float]]] = {}
    for symbol in {samples[i].spec.symbol for i in testable}:
        spec = next(samples[i].spec for i in testable if samples[i].spec.symbol == symbol)
        wanted = sorted({minutes[c.label][i] for c in candidates for i in testable if samples[i].spec.symbol == symbol})
        stored = store.read(spec.source, spec.symbol, wanted[0], wanted[-1] + MINUTE_MS)
        index = {int(t): (float(lo), float(hi)) for t, lo, hi in zip(stored.ts, stored.low, stored.high)}
        bars[symbol] = {m: index[m] for m in wanted if m in index}

    signatures: dict[tuple, Candidate] = {}
    rates: dict[str, float] = {}
    for candidate in candidates:
        hits = 0
        for i in testable:
            sample = samples[i]
            bar = bars[sample.spec.symbol].get(minutes[candidate.label][i])
            if bar is None:
                continue
            tol = tolerance(sample.spec, sample.entry_price)
            hits += bar[0] - tol <= sample.entry_price <= bar[1] + tol
        rates[candidate.label] = hits / len(testable)
        signatures.setdefault(tuple(minutes[candidate.label][i] for i in testable), candidate)

    distinct = sorted(signatures.values(), key=lambda c: (-rates[c.label], candidates.index(c)))
    best = distinct[0]
    runner = distinct[1] if len(distinct) > 1 else None
    best_rate = rates[best.label]
    runner_rate = rates[runner.label] if runner else None
    margin = best_rate - (runner_rate or 0.0)
    return Detection(
        best=best,
        confidence=confidence_for(best_rate, margin, len(testable)),
        match_rate=round(best_rate, 4),
        sample_size=len(testable),
        runner_up=runner,
        runner_up_rate=None if runner_rate is None else round(runner_rate, 4),
        scores={label: round(rate, 4) for label, rate in rates.items()},
    )


def _samples(db: Session, account: Account, force_naive: bool) -> tuple[list[Sample], uuid.UUID | None]:
    stmt = live_trades(account.user_id).where(Trade.account_id == account.id)
    if not force_naive:
        stmt = stmt.where(Trade.time_basis.in_(NAIVE_BASES))
    trades = list(db.scalars(stmt.order_by(Trade.opened_at.desc()).limit(MAX_TRADES)))
    samples = []
    for trade in trades:
        if trade.opened_at is None or trade.entry_price is None:
            continue
        broker = trade.source.split(":", 1)[1] if trade.source and ":" in trade.source else None
        resolution = resolve_symbol(db, broker, trade.canonical_symbol or trade.symbol, record=False)
        if resolution.instrument is None:
            continue
        samples.append(Sample(trade.id, resolution.instrument, wall_clock(trade.opened_at), float(trade.entry_price)))
    broker_account = next((t.broker_account_id for t in trades if t.broker_account_id), None)
    return samples, broker_account


def detect_account(
    db: Session,
    account: Account,
    *,
    store: CandleStore | None = None,
    force_naive: bool = False,
    candidates: list[Candidate] | None = None,
) -> AccountTimeOffset | None:
    """Score candidates for one account and upsert the result. None when detection could not run."""
    user = db.get(User, account.user_id)
    samples, broker_account = _samples(db, account, force_naive)
    if not samples:
        return None
    detection = score(samples, candidates or candidates_for(user.timezone if user else None), db, store or get_store())
    if detection is None:
        return None
    values = {
        "account_id": account.id,
        "user_id": account.user_id,
        "broker_account_id": broker_account,
        "tz_kind": detection.best.kind,
        "tz_value": detection.best.value,
        "confidence": detection.confidence,
        "match_rate": detection.match_rate,
        "sample_size": detection.sample_size,
        "runner_up": detection.runner_up.label if detection.runner_up else None,
        "runner_up_rate": detection.runner_up_rate,
        "method": FORCED_METHOD if force_naive else METHOD,
        "scores": detection.scores,
        "computed_at": datetime.now(timezone.utc),
    }
    stmt = insert(AccountTimeOffset.__table__).values(**values)
    db.execute(stmt.on_conflict_do_update(index_elements=["account_id"], set_={k: v for k, v in values.items() if k != "account_id"}))
    db.flush()
    row = db.get(AccountTimeOffset, account.id)
    db.refresh(row)
    logger.info(
        "time offset detected",
        extra={"account": str(account.id), "tz": detection.best.label, "confidence": detection.confidence, "n": detection.sample_size},
    )
    return row


def detect_offsets(
    db: Session,
    *,
    user_id: uuid.UUID | None = None,
    account_id: uuid.UUID | None = None,
    force_naive: bool = False,
    store: CandleStore | None = None,
) -> list[tuple[Account, AccountTimeOffset | None]]:
    stmt = select(Account)
    if user_id:
        stmt = stmt.where(Account.user_id == user_id)
    if account_id:
        stmt = stmt.where(Account.id == account_id)
    results = []
    for account in db.scalars(stmt.order_by(Account.user_id, Account.name)):
        results.append((account, detect_account(db, account, store=store, force_naive=force_naive)))
    db.commit()
    return results


@dataclass(frozen=True)
class EffectiveTime:
    utc: datetime
    rule: str  # utc_aware | detected_offset | profile_timezone | stored_utc
    tz_label: str | None = None


def effective_utc(
    stored: datetime,
    time_basis: str,
    offset: AccountTimeOffset | None,
    user_timezone: str | None,
) -> EffectiveTime:
    """Fallback order from AUDIT section 3: aware values as-is; otherwise a confident detected offset;
    otherwise the profile timezone for naive wall clocks, or the stored value for unknown ones."""
    aware = stored if stored.tzinfo else stored.replace(tzinfo=timezone.utc)
    if time_basis == "utc_aware":
        return EffectiveTime(aware.astimezone(timezone.utc), "utc_aware")
    wall = wall_clock(stored)
    if offset is not None and offset.confidence in ("high", "medium"):
        candidate = candidate_from_row(offset)
        return EffectiveTime(candidate.to_utc(wall), "detected_offset", candidate.label)
    if time_basis == "naive_wall_clock":
        candidate = parse_candidate(user_timezone or "UTC") or Candidate("UTC", "iana", "UTC")
        return EffectiveTime(candidate.to_utc(wall), "profile_timezone", candidate.label)
    return EffectiveTime(aware.astimezone(timezone.utc), "stored_utc")


def offsets_report(db: Session, limit: int = 200) -> list[dict]:
    rows = db.execute(
        select(AccountTimeOffset, Account.name, User.email)
        .join(Account, Account.id == AccountTimeOffset.account_id)
        .join(User, User.id == AccountTimeOffset.user_id)
        .order_by(AccountTimeOffset.computed_at.desc())
        .limit(limit)
    ).all()
    return [
        {
            "account_id": str(row.account_id),
            "account_name": name,
            "user_email": email,
            "broker_account_id": str(row.broker_account_id) if row.broker_account_id else None,
            "tz_kind": row.tz_kind,
            "tz_value": row.tz_value,
            "confidence": row.confidence,
            "match_rate": row.match_rate,
            "sample_size": row.sample_size,
            "runner_up": row.runner_up,
            "runner_up_rate": row.runner_up_rate,
            "method": row.method,
            "scores": row.scores,
            "computed_at": row.computed_at,
        }
        for row, name, email in rows
    ]
