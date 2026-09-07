"""Built-in TradeFix masters seeded per user on first access."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.trade_master import MasterCategory, TradeMaster

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
        "Support/Resistance",
        "News/Catalyst",
        "Reversal",
    ],
}


def _seed_user_masters(db: Session, user_id: uuid.UUID) -> None:
    existing_rows = list(db.scalars(select(TradeMaster).where(TradeMaster.user_id == user_id)).all())
    existing_keys = {(row.category, row.name.strip().lower()) for row in existing_rows}
    rows: list[TradeMaster] = []
    for category, names in BUILTIN_MASTERS.items():
        existing_count = sum(1 for row in existing_rows if row.category == category)
        next_order = existing_count
        for idx, name in enumerate(names):
            if (category, name.strip().lower()) in existing_keys:
                continue
            rows.append(
                TradeMaster(
                    user_id=user_id,
                    category=category,
                    name=name,
                    sort_order=idx if existing_count == 0 else next_order,
                    is_builtin=True,
                )
            )
            next_order += 1
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
) -> TradeMaster:
    _seed_user_masters(db, user_id)
    cleaned = " ".join((name or "").split())
    if category == MasterCategory.symbol:
        cleaned = cleaned.upper()
    existing = find_master(db, user_id, category, cleaned)
    if existing:
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
    )
    db.add(row)
    db.flush()
    return row
