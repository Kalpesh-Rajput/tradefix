"""Built-in TradeFix masters seeded per user on first access."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.trade_master import MasterCategory, TradeMaster
from app.models.user import User

BUILTIN_MASTERS: dict[MasterCategory, list[str]] = {
    MasterCategory.symbol: [
        "EURUSD",
        "GBPUSD",
        "USDJPY",
        "USDCHF",
        "AUDUSD",
        "USDCAD",
        "NZDUSD",
        "EURGBP",
        "EURJPY",
        "GBPJPY",
        "XAUUSD",
        "XAGUSD",
        "BTCUSD",
        "ETHUSD",
        "AAPL",
        "NVDA",
        "TSLA",
        "MSFT",
        "SPY",
        "QQQ",
        "ES1!",
        "NQ1!",
    ],
    MasterCategory.entry_condition: [
        "Breakout",
        "Breakdown",
        "Support Bounce",
        "Resistance Rejection",
        "Pullback",
        "Trend Continuation",
        "Reversal",
        "Order Block",
        "Fair Value Gap",
        "Liquidity Grab",
        "Session Open",
        "News Catalyst",
        "Accurate Entry",
        "Early Entry",
        "Early Without Confirmation",
        "FOMO",
        "Late Entry",
        "Revenge",
        "Deadline Breakout Entry",
        "Trailer Pullback Entry",
        "Breakout of Support and Resistance",
    ],
    MasterCategory.exit_condition: [
        "Target Hit",
        "Stop Loss",
        "Trailing Stop",
        "Partial Profit",
        "Break Even",
        "Time Based",
        "Manual Close",
        "Opposite Signal",
        "News Exit",
    ],
    MasterCategory.timeframe: ["1m", "3m", "5m", "15m", "30m", "1H", "4H", "Daily", "Weekly"],
    MasterCategory.session: [
        "Asian",
        "London",
        "New York",
        "Sydney",
        "London/NY Overlap",
        "Asian/London Overlap",
    ],
    MasterCategory.trade_type: ["Scalping", "Intraday", "Swing", "Positional", "Investment"],
    MasterCategory.mood: [
        "Calm",
        "Confident",
        "Disciplined",
        "Neutral",
        "Fearful",
        "FOMO",
        "Revenge",
        "Excited",
        "Anxious",
        "Tired",
    ],
    MasterCategory.strategy: [
        "Breakout",
        "Trend Following",
        "Mean Reversion",
        "Scalping",
        "Swing Trade",
        "Momentum",
        "Gap Fill",
        "Support/Resistance",
        "News/Catalyst",
        "Earnings Play",
        "Options Spread",
        "Reversal",
    ],
    MasterCategory.mistake: [
        "Broke Rules",
        "FOMO Entry",
        "Revenge Trading",
        "Overtrading",
        "Ignored Stop Loss",
        "Moved Stop Loss",
        "Position Too Large",
        "Exited Too Early",
        "Exited Too Late",
        "Chased Entry",
        "No Trading Plan",
        "Emotional Decision",
        "Poor Risk/Reward",
        "Wrong Timeframe",
        "Ignored Signals",
    ],
    MasterCategory.went_well: [
        "Followed Plan",
        "Solid Risk/Reward",
        "Patient Entry",
        "Disciplined Exit",
        "Respected Stops",
        "Sized Position Well",
        "Clear Setup",
        "Avoided FOMO",
        "Took Profit as Planned",
        "Good Market Timing",
        "Journaling/Review Helped",
        "Other Positive",
    ],
}


def parse_label_list(value) -> list[str]:
    """Accept a list of labels or a legacy comma-separated string."""
    if value is None:
        return []
    if isinstance(value, list):
        out: list[str] = []
        seen: set[str] = set()
        for item in value:
            cleaned = " ".join(str(item).split())
            key = cleaned.lower()
            if not cleaned or key in seen:
                continue
            seen.add(key)
            out.append(cleaned)
        return out
    if isinstance(value, str):
        return parse_label_list([part for part in value.split(",")])
    return []


def parse_went_well(value) -> list[str]:
    return parse_label_list(value)


def parse_moods(value) -> list[str]:
    return parse_label_list(value)


def pack_moods(extra: dict | None, mood: str | None, *, from_list: bool) -> tuple[dict, str | None, list[str]]:
    """Store the selected moods on extra and a readable summary on the mood column."""
    data = dict(extra or {})
    labels = parse_moods(data.get("moods") if from_list else mood)
    data["moods"] = labels
    summary = ", ".join(labels) if labels else None
    return data, summary, labels


def _clean_name(name: str) -> str:
    return " ".join((name or "").split())


def _append_missing(
    rows: list[TradeMaster],
    existing_keys: set[tuple[MasterCategory, str]],
    existing_rows: list[TradeMaster],
    user_id: uuid.UUID,
    category: MasterCategory,
    names: list,
    *,
    builtin: bool,
) -> None:
    pending = sum(1 for row in rows if row.category == category)
    existing_count = sum(1 for row in existing_rows if row.category == category)
    next_order = existing_count + pending
    for idx, raw in enumerate(names):
        cleaned = _clean_name(str(raw))
        if not cleaned:
            continue
        key = (category, cleaned.lower())
        if key in existing_keys:
            continue
        rows.append(
            TradeMaster(
                user_id=user_id,
                category=category,
                name=cleaned,
                sort_order=idx if existing_count == 0 and pending == 0 else next_order,
                is_builtin=builtin,
                is_active=True,
            )
        )
        existing_keys.add(key)
        next_order += 1


def _seed_user_masters(db: Session, user_id: uuid.UUID) -> None:
    existing_rows = list(db.scalars(select(TradeMaster).where(TradeMaster.user_id == user_id)).all())
    existing_keys = {(row.category, row.name.strip().lower()) for row in existing_rows}
    rows: list[TradeMaster] = []
    for category, names in BUILTIN_MASTERS.items():
        _append_missing(rows, existing_keys, existing_rows, user_id, category, names, builtin=True)

    user = db.get(User, user_id)
    if user is not None:
        _append_missing(
            rows,
            existing_keys,
            existing_rows,
            user_id,
            MasterCategory.strategy,
            list(user.custom_strategies or []),
            builtin=False,
        )
        _append_missing(
            rows,
            existing_keys,
            existing_rows,
            user_id,
            MasterCategory.mistake,
            list(user.custom_mistakes or []),
            builtin=False,
        )
    if rows:
        db.add_all(rows)
        db.flush()


def list_masters(db: Session, user_id: uuid.UUID, category: MasterCategory | None = None) -> list[TradeMaster]:
    _seed_user_masters(db, user_id)
    stmt = select(TradeMaster).where(TradeMaster.user_id == user_id)
    if category:
        stmt = stmt.where(TradeMaster.category == category)
    stmt = stmt.order_by(TradeMaster.category, TradeMaster.sort_order, TradeMaster.name)
    return list(db.scalars(stmt).all())


def find_master(
    db: Session, user_id: uuid.UUID, category: MasterCategory, name: str
) -> TradeMaster | None:
    if not name:
        return None
    stmt = select(TradeMaster).where(
        TradeMaster.user_id == user_id,
        TradeMaster.category == category,
        func.lower(TradeMaster.name) == name.strip().lower(),
    )
    return db.scalars(stmt).first()


def upsert_master(
    db: Session,
    user_id: uuid.UUID,
    category: MasterCategory,
    name: str,
    *,
    builtin: bool = False,
    reactivate: bool = False,
) -> TradeMaster:
    _seed_user_masters(db, user_id)
    cleaned = " ".join((name or "").split())
    if category == MasterCategory.symbol:
        cleaned = cleaned.upper()
    existing = find_master(db, user_id, category, cleaned)
    if existing:
        if reactivate and not existing.is_active:
            existing.is_active = True
        return existing
    count = db.scalar(
        select(func.count()).select_from(TradeMaster).where(
            TradeMaster.user_id == user_id, TradeMaster.category == category
        )
    ) or 0
    row = TradeMaster(
        user_id=user_id,
        category=category,
        name=cleaned,
        sort_order=int(count),
        is_builtin=builtin,
        is_active=True,
    )
    db.add(row)
    db.flush()
    return row


def unknown_master_labels(
    db: Session,
    user_id: uuid.UUID,
    category: MasterCategory,
    labels: list[str] | None,
    allowed: list[str] | None = None,
) -> list[str]:
    """Labels that are neither a master (active or inactive) nor an already-saved value."""
    _seed_user_masters(db, user_id)
    rows = db.scalars(
        select(TradeMaster).where(TradeMaster.user_id == user_id, TradeMaster.category == category)
    ).all()
    known = {row.name.strip().lower() for row in rows}
    extra = {_clean_name(item).lower() for item in (allowed or []) if _clean_name(str(item))}
    ok = known | extra
    bad: list[str] = []
    seen: set[str] = set()
    for raw in labels or []:
        cleaned = _clean_name(str(raw))
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in ok or key in seen:
            continue
        seen.add(key)
        bad.append(cleaned)
    return bad
