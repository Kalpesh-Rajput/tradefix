"""Seed closed dummy trades across a date range.

Usage (from backend/ with venv active):
  python -m scripts.seed_month_trades --count 100
  python -m scripts.seed_month_trades --email you@example.com --count 100 --days 180 --replace
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

SEED_BATCH = "dummy_v1"

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
    ("MSFT", AssetType.stock, 420.0, 5.0),
    ("AMZN", AssetType.stock, 185.0, 4.0),
    ("META", AssetType.stock, 510.0, 8.0),
    ("BTCUSD", AssetType.crypto, 64000.0, 800.0),
    ("ETHUSD", AssetType.crypto, 3200.0, 80.0),
]

SETUPS = [
    "Breakout",
    "Trend Following",
    "Mean Reversion",
    "Scalping",
    "Support/Resistance",
    "Liquidity Sweep",
    "Momentum",
    "ORB",
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
    "Held through pullback — patience paid.",
    "Overtraded after win streak.",
]


def _range_bounds(now: datetime, days: int) -> tuple[datetime, datetime]:
    end = now
    start = now - timedelta(days=max(1, days - 1))
    return start, end


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
        gross = (exit_p - entry) * direction * qty * 0.01
    elif asset == AssetType.forex:
        gross = (exit_p - entry) * direction * qty
    else:
        gross = (exit_p - entry) * direction * qty

    fees = round(rng.uniform(1.5, 12.0), 2)
    pnl = round(gross - fees, 2)
    risk = round(
        abs(atr * qty * (0.01 if asset == AssetType.forex and symbol.endswith("JPY") else 1)) * 0.5,
        2,
    )
    if risk < 20:
        risk = round(rng.uniform(25, 150), 2)

    setup = rng.choice(SETUPS)
    emotion = rng.choice(EMOTIONS)
    mistakes: list[str] = []
    if not win and rng.random() < 0.55:
        mistakes = rng.sample(MISTAKES, k=rng.randint(1, 2))

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
        extra={"seeded": True, "seed_batch": SEED_BATCH},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed dummy trades across a date range")
    parser.add_argument("--email", default=None, help="User email (default: first user)")
    parser.add_argument("--count", type=int, default=100, help="Number of trades (default 100)")
    parser.add_argument(
        "--days",
        type=int,
        default=180,
        help="Spread trades across the last N days (default 180)",
    )
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility")
    parser.add_argument(
        "--replace",
        action="store_true",
        help=f"Delete previously seeded trades (extra.seed_batch={SEED_BATCH} or month_50) first",
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
        ) or db.scalar(
            select(Account).where(Account.user_id == user.id).order_by(Account.created_at.asc())
        )
        if not account:
            raise SystemExit("No account found for user.")

        now = datetime.now(timezone.utc)
        start, end = _range_bounds(now, args.days)

        if args.replace:
            existing = db.scalars(
                select(Trade).where(
                    Trade.user_id == user.id,
                    Trade.account_id == account.id,
                )
            ).all()
            removed = 0
            for t in existing:
                batch = t.extra.get("seed_batch") if isinstance(t.extra, dict) else None
                if batch in (SEED_BATCH, "month_50"):
                    db.delete(t)
                    removed += 1
            db.commit()
            print(f"Removed {removed} previously seeded trades.")

        trades: list[Trade] = []
        for i in range(args.count):
            if args.count == 1:
                opened = start
            else:
                frac = i / (args.count - 1)
                slot = start + timedelta(seconds=int((end - start).total_seconds() * frac))
                jitter = timedelta(hours=rng.randint(-8, 8), minutes=rng.choice([0, 15, 30, 45]))
                opened = slot + jitter
            if opened < start:
                opened = start + timedelta(hours=rng.randint(1, 6))
            if opened > end:
                opened = end - timedelta(hours=1)

            attempts = 0
            while opened.weekday() >= 5 and attempts < 5:
                opened = opened - timedelta(days=1)
                attempts += 1
            if opened < start:
                opened = start + timedelta(hours=rng.randint(8, 16))

            opened = opened.replace(
                hour=rng.randint(6, 20),
                minute=rng.choice([0, 15, 30, 45]),
                second=0,
                microsecond=0,
            )
            trades.append(
                build_trade(user_id=user.id, account_id=account.id, opened_at=opened, rng=rng)
            )

        db.add_all(trades)
        db.commit()
        pnls = [float(t.pnl or 0) for t in trades]
        dates = sorted({t.opened_at.date() for t in trades if t.opened_at})
        print(
            f"Seeded {len(trades)} trades for {user.email} / {account.name}\n"
            f"Range: {start.date()} to {end.date()} ({len(dates)} unique days)\n"
            f"Total P&L: {sum(pnls):+.2f} | Wins: {sum(1 for p in pnls if p > 0)} | "
            f"Losses: {sum(1 for p in pnls if p < 0)}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
