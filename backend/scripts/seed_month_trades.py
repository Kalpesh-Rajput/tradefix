"""Seed 50 closed dummy trades for the current calendar month.

Usage (from backend/ with venv active):
  python -m scripts.seed_month_trades
  python -m scripts.seed_month_trades --email you@example.com
"""

from __future__ import annotations

import argparse
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.account import Account
from app.models.trade import AssetType, Trade, TradeSide, TradeStatus
from app.models.user import User

SYMBOLS = [
    ("EURUSD", AssetType.forex, 1.08, 0.0025),
    ("GBPUSD", AssetType.forex, 1.27, 0.003),
    ("USDJPY", AssetType.forex, 149.5, 0.35),
    ("XAUUSD", AssetType.forex, 2350.0, 8.0),
    ("NAS100", AssetType.future, 17800.0, 45.0),
    ("US30", AssetType.future, 39500.0, 80.0),
    ("AAPL", AssetType.stock, 190.0, 2.5),
    ("TSLA", AssetType.stock, 245.0, 6.0),
    ("NVDA", AssetType.stock, 120.0, 3.5),
    ("BTCUSD", AssetType.crypto, 64000.0, 800.0),
]

SETUPS = [
    "Breakout",
    "Trend Following",
    "Mean Reversion",
    "Scalping",
    "Support/Resistance",
    "Liquidity Sweep",
    "Momentum",
]

EMOTIONS = [
    "Calm/Neutral",
    "FOMO Entry",
    "Revenge Trading",
    "Overconfidence",
    "Fear of Loss",
    "Emotional Decision",
]

MISTAKES = [
    "Broke Rules",
    "Exited Too Early",
    "Exited Too Late",
    "Position Too Large",
    "Ignored Stop Loss",
    "Chased Entry",
    "No Trading Plan",
]

NOTES = [
    "Clean London open continuation.",
    "Took partials into NY open.",
    "FOMO'd the second entry — note for journal.",
    "Respected stop, moved to BE after 1R.",
    "News spike — size was too large.",
    "Best setup of the week: sweep then reclaim.",
    "Cut early before target. Process miss.",
    "Textbook pin bar at support.",
]


def _month_bounds(now: datetime) -> tuple[datetime, datetime]:
    start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    if now.month == 12:
        end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
    else:
        end = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
    # Don't seed into the future past "now"
    if end > now:
        end = now
    return start, end


def _rand_dt(start: datetime, end: datetime, rng: random.Random) -> datetime:
    span = max(1, int((end - start).total_seconds()))
    return start + timedelta(seconds=rng.randint(0, span))


def build_trade(
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    opened_at: datetime,
    rng: random.Random,
) -> Trade:
    symbol, asset, base, atr = rng.choice(SYMBOLS)
    side = rng.choice([TradeSide.long, TradeSide.short])
    win = rng.random() < 0.55

    qty = {
        AssetType.forex: rng.choice([10000, 20000, 50000, 100000]),
        AssetType.future: rng.choice([1, 2, 3]),
        AssetType.stock: rng.choice([10, 25, 50, 100]),
        AssetType.crypto: rng.choice([0.01, 0.05, 0.1, 0.25]),
    }.get(asset, 1)

    entry = round(base + rng.uniform(-atr, atr), 5 if asset == AssetType.forex else 2)
    move = atr * rng.uniform(0.3, 1.8)
    if side == TradeSide.long:
        exit_p = entry + move if win else entry - move * rng.uniform(0.4, 1.0)
    else:
        exit_p = entry - move if win else entry + move * rng.uniform(0.4, 1.0)
    exit_p = round(exit_p, 5 if asset == AssetType.forex else 2)

    hold_mins = rng.randint(15, 360)
    closed_at = opened_at + timedelta(minutes=hold_mins)

    direction = 1 if side == TradeSide.long else -1
    if asset == AssetType.forex and symbol.endswith("JPY"):
        gross = (exit_p - entry) * direction * qty * 0.01  # rough pip value proxy
    elif asset == AssetType.forex:
        gross = (exit_p - entry) * direction * qty
    else:
        gross = (exit_p - entry) * direction * qty

    fees = round(rng.uniform(1.5, 12.0), 2)
    pnl = round(gross - fees, 2)
    risk = round(abs(atr * qty * (0.01 if asset == AssetType.forex and symbol.endswith("JPY") else 1)) * 0.5, 2)
    if risk < 20:
        risk = round(rng.uniform(25, 150), 2)

    setup = rng.choice(SETUPS)
    emotion = rng.choice(EMOTIONS)
    mistakes = []
    if not win and rng.random() < 0.55:
        mistakes = rng.sample(MISTAKES, k=rng.randint(1, 2))
    if emotion == "Revenge Trading" and "Revenge Trading" not in mistakes:
        pass

    compliance = rng.randint(4, 10) if win else rng.randint(2, 8)

    return Trade(
        user_id=user_id,
        account_id=account_id,
        symbol=symbol,
        asset_type=asset,
        side=side,
        quantity=qty,
        entry_price=entry,
        exit_price=exit_p,
        opened_at=opened_at,
        closed_at=closed_at,
        fees=fees,
        pnl=pnl,
        risk_amount=risk,
        setup_tag=setup,
        setup_tags=[setup],
        emotion_tags=[emotion],
        plan_compliance=compliance,
        mood=str(rng.randint(3, 9)),
        notes=rng.choice(NOTES),
        rules_broken=mistakes,
        score_preparation=rng.randint(4, 10),
        score_risk=rng.randint(4, 10),
        score_entry=rng.randint(3, 10),
        score_exit=rng.randint(3, 10),
        score_discipline=rng.randint(3, 10),
        score_psychology=rng.randint(3, 10),
        status=TradeStatus.closed,
        screenshot_urls=[],
        auto_flags=[],
        extra={"seeded": True, "seed_batch": "month_50"},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed 50 dummy trades for the current month")
    parser.add_argument("--email", default=None, help="User email (default: first user)")
    parser.add_argument("--count", type=int, default=50, help="Number of trades (default 50)")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete previously seeded month trades (extra.seed_batch=month_50) first",
    )
    args = parser.parse_args()
    rng = random.Random(args.seed)

    db = SessionLocal()
    try:
        if args.email:
            user = db.scalar(select(User).where(User.email == args.email.lower()))
        else:
            user = db.scalar(select(User).order_by(User.created_at.asc()))
        if not user:
            raise SystemExit("No user found. Sign up in the app first.")

        account = db.scalar(
            select(Account).where(Account.user_id == user.id, Account.is_default.is_(True))
        ) or db.scalar(select(Account).where(Account.user_id == user.id).order_by(Account.created_at.asc()))
        if not account:
            raise SystemExit("No account found for user.")

        now = datetime.now(timezone.utc)
        start, end = _month_bounds(now)

        if args.replace:
            existing = db.scalars(
                select(Trade).where(
                    Trade.user_id == user.id,
                    Trade.account_id == account.id,
                )
            ).all()
            removed = 0
            for t in existing:
                if isinstance(t.extra, dict) and t.extra.get("seed_batch") == "month_50":
                    db.delete(t)
                    removed += 1
            db.commit()
            print(f"Removed {removed} previously seeded trades.")

        trades = []
        for _ in range(args.count):
            opened = _rand_dt(start, end, rng)
            # Prefer weekdays
            while opened.weekday() >= 5 and rng.random() < 0.7:
                opened = _rand_dt(start, end, rng)
            opened = opened.replace(hour=rng.randint(6, 20), minute=rng.choice([0, 15, 30, 45]))
            if opened > end:
                opened = end - timedelta(hours=1)
            trades.append(
                build_trade(user_id=user.id, account_id=account.id, opened_at=opened, rng=rng)
            )

        db.add_all(trades)
        db.commit()
        pnls = [float(t.pnl or 0) for t in trades]
        print(
            f"Seeded {len(trades)} trades for {user.email} / {account.name}\n"
            f"Month: {start.date()} to {end.date()}\n"
            f"Total P&L: {sum(pnls):+.2f} | Wins: {sum(1 for p in pnls if p > 0)} | "
            f"Losses: {sum(1 for p in pnls if p < 0)}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
