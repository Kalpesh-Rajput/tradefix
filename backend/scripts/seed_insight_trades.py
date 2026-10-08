"""Seed closed dummy trades that cover every Trade Master value.

Each symbol, entry, exit, timeframe, session, trade type, mood, strategy,
mistake, and "what went well" label is attached to at least one winning and
one losing trade, so every detailed-insight metric has a real value.

Usage (from backend/):
  python -m scripts.seed_insight_trades
  python -m scripts.seed_insight_trades --email you@example.com --replace
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.account import Account
from app.models.trade import AssetType, Trade, TradeSide, TradeStatus
from app.models.trade_master import MasterCategory
from app.models.user import User
from app.services.masters_service import list_masters

SEED_BATCH = "insight_demo_v1"

FOREX = {
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
}
CRYPTO = {"BTCUSD", "ETHUSD"}
FUTURES = {"ES1!", "NQ1!"}


def _names(db, user_id, category: MasterCategory) -> list[str]:
    rows = [row for row in list_masters(db, user_id, category) if row.is_active and row.name.strip()]
    return [row.name.strip() for row in rows]


def _asset(symbol: str) -> AssetType:
    upper = symbol.upper()
    if upper in CRYPTO:
        return AssetType.crypto
    if upper in FUTURES:
        return AssetType.future
    if upper in FOREX or upper.endswith("USD"):
        return AssetType.forex
    return AssetType.stock


def _pnl(label: str, win: bool) -> float:
    span = sum(ord(char) for char in label) % 1600
    if win:
        return round(180 + span + (span % 7) * 25, 2)
    return round(-(55 + (span % 900) + (span % 5) * 18), 2)


def _opened_at(index: int, total: int, now: datetime) -> datetime:
    day_offset = 1 + (index * 26 // max(total, 1))
    day = (now - timedelta(days=day_offset)).replace(hour=8, minute=0, second=0, microsecond=0)
    while day.weekday() >= 5:
        day -= timedelta(days=1)
    hour = 7 + (index % 10)
    return day.replace(hour=hour, minute=(index * 7) % 60)


def _trade(
    *,
    user_id,
    account_id,
    opened_at: datetime,
    symbol: str,
    entry: str,
    exit_condition: str,
    timeframe: str,
    session: str,
    trade_type: str,
    mood: str,
    strategy: str,
    mistake: str,
    went_well: str,
    win: bool,
    side: TradeSide,
) -> Trade:
    pnl = _pnl(symbol, win)
    qty = 1.0
    entry_price = 100.0
    direction = 1 if side == TradeSide.long else -1
    exit_price = round(entry_price + direction * (pnl / 10), 4)
    hold = timedelta(minutes=20 + (abs(int(pnl)) % 240))
    return Trade(
        user_id=user_id,
        account_id=account_id,
        symbol=symbol.upper(),
        asset_type=_asset(symbol),
        side=side,
        quantity=qty,
        entry_price=entry_price,
        exit_price=exit_price,
        opened_at=opened_at,
        closed_at=opened_at + hold,
        fees=2,
        pnl=pnl,
        risk_amount=round(abs(pnl) * 0.5, 2),
        setup_tag=strategy,
        setup_tags=[strategy],
        emotion_tags=[mood],
        plan_compliance=8 if win else 4,
        mood=mood,
        notes="Dummy trade for Trading Master insights charts.",
        rules_broken=[mistake],
        status=TradeStatus.closed,
        screenshot_urls=[],
        auto_flags=[],
        year=opened_at.year,
        month=opened_at.month,
        session=session,
        trade_type=trade_type,
        entry_timeframe=timeframe,
        analysis_timeframe=timeframe,
        entry_condition=entry,
        exit_condition=exit_condition,
        strategy_name=strategy,
        extra={
            "seeded": True,
            "seed_batch": SEED_BATCH,
            "moods": [mood],
            "went_well": [went_well],
        },
    )


def _pick(values: list[str], index: int) -> str:
    return values[index % len(values)]


def build_trades(db, user_id, account_id) -> list[Trade]:
    catalogs = {
        "symbol": _names(db, user_id, MasterCategory.symbol),
        "entry": _names(db, user_id, MasterCategory.entry_condition),
        "exit": _names(db, user_id, MasterCategory.exit_condition),
        "timeframe": _names(db, user_id, MasterCategory.timeframe),
        "session": _names(db, user_id, MasterCategory.session),
        "trade_type": _names(db, user_id, MasterCategory.trade_type),
        "mood": _names(db, user_id, MasterCategory.mood),
        "strategy": _names(db, user_id, MasterCategory.strategy),
        "mistake": _names(db, user_id, MasterCategory.mistake),
        "went_well": _names(db, user_id, MasterCategory.went_well),
    }
    missing = [key for key, values in catalogs.items() if not values]
    if missing:
        raise SystemExit(f"No Trade Master values for: {', '.join(missing)}")

    span = max(len(values) for values in catalogs.values())
    now = datetime.now(timezone.utc)
    total = span * 2
    trades: list[Trade] = []
    cursor = 0
    for win in (True, False):
        for index in range(span):
            symbol = _pick(catalogs["symbol"], index)
            trades.append(
                _trade(
                    user_id=user_id,
                    account_id=account_id,
                    opened_at=_opened_at(cursor, total, now),
                    symbol=symbol,
                    entry=_pick(catalogs["entry"], index),
                    exit_condition=_pick(catalogs["exit"], index),
                    timeframe=_pick(catalogs["timeframe"], index),
                    session=_pick(catalogs["session"], index),
                    trade_type=_pick(catalogs["trade_type"], index),
                    mood=_pick(catalogs["mood"], index),
                    strategy=_pick(catalogs["strategy"], index),
                    mistake=_pick(catalogs["mistake"], index),
                    went_well=_pick(catalogs["went_well"], index),
                    win=win,
                    side=TradeSide.long if index % 2 == 0 else TradeSide.short,
                )
            )
            cursor += 1
    return trades


def _remove_batch(db, user_id, account_id) -> int:
    existing = db.scalars(
        select(Trade).where(Trade.user_id == user_id, Trade.account_id == account_id)
    ).all()
    removed = 0
    for trade in existing:
        batch = trade.extra.get("seed_batch") if isinstance(trade.extra, dict) else None
        if batch == SEED_BATCH:
            db.delete(trade)
            removed += 1
    return removed


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed dummy trades covering every Trade Master value")
    parser.add_argument("--email", default=None, help="User email (default: every user with an account)")
    parser.add_argument(
        "--replace",
        action="store_true",
        help=f"Delete a previous {SEED_BATCH} batch before inserting",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.email:
            users = list(db.scalars(select(User).where(User.email == args.email.lower())).all())
            if not users:
                raise SystemExit(f"No user found for {args.email}")
        else:
            users = list(db.scalars(select(User).order_by(User.created_at.asc())).all())
        if not users:
            raise SystemExit("No user found. Sign up in the app first.")

        for user in users:
            account = db.scalar(
                select(Account).where(Account.user_id == user.id, Account.is_default.is_(True))
            ) or db.scalar(select(Account).where(Account.user_id == user.id).order_by(Account.created_at.asc()))
            if account is None:
                print(f"Skipped {user.email}: no account.")
                continue
            if args.replace:
                removed = _remove_batch(db, user.id, account.id)
                db.commit()
                print(f"Removed {removed} previous {SEED_BATCH} trades for {user.email}.")
            trades = build_trades(db, user.id, account.id)
            db.add_all(trades)
            db.commit()
            wins = sum(1 for trade in trades if float(trade.pnl or 0) > 0)
            losses = sum(1 for trade in trades if float(trade.pnl or 0) < 0)
            print(
                f"Seeded {len(trades)} trades for {user.email} / {account.name} "
                f"({wins} wins, {losses} losses, P&L {sum(float(t.pnl or 0) for t in trades):+.2f})."
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
