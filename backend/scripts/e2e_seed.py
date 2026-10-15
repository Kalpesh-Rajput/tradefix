"""Seed an isolated database and data directory for browser tests.

Point DATABASE_URL and MARKET_DATA_DIR at the e2e database and an empty folder first.
This does not touch the development database unless those variables already point at it.

    createdb tradefix_e2e
    $env:DATABASE_URL = ".../tradefix_e2e"
    $env:MARKET_DATA_DIR = "D:\\tmp\\tradefix-e2e-data"
    $env:ENVIRONMENT = "test"
    alembic upgrade head
    python -m scripts.e2e_seed
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.account import Account
from app.models.trade import Trade, TradeSide, TradeStatus
from app.models.user import User
from app.services.marketdata.candles import Candles
from app.services.marketdata.coverage import record_fetch
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import get_store

PASSWORD = "e2e-pass-1"
TRADER = "e2e-trader@example.com"
ADMIN = "e2e-admin@example.com"
START = datetime(2026, 9, 1, 12, tzinfo=timezone.utc)


def _user(db, email: str, role: str) -> User:
    row = db.query(User).filter(User.email == email).one_or_none()
    if row is None:
        row = User(email=email, password_hash=hash_password(PASSWORD), name=email.split("@")[0], role=role, theme="tradefix-purple")
        db.add(row)
        db.flush()
        db.add(Account(user_id=row.id, name="Main", is_default=True))
        db.flush()
    row.role = role
    return row


def main() -> int:
    start_ms = int(START.timestamp() * 1000)
    rows = []
    for index in range(180):
        price = 100 + index * 0.1
        rows.append((start_ms + index * 60_000, price, price + 1, price - 1, price, 1))
    candles = Candles.from_rows(rows)
    spec = get_instrument("BTCUSDT")
    with SessionLocal() as db:
        mirror_to_db(db)
        store = get_store()
        record_fetch(db, store, spec, start_ms, start_ms + 180 * 60_000, candles)
        trader = _user(db, TRADER, "trader")
        _user(db, ADMIN, "admin")
        account = db.query(Account).filter(Account.user_id == trader.id).one()
        existing = db.query(Trade).filter(Trade.user_id == trader.id, Trade.symbol == "BTCUSDT").one_or_none()
        if existing is None:
            db.add(
                Trade(
                    user_id=trader.id,
                    account_id=account.id,
                    symbol="BTCUSDT",
                    side=TradeSide.long,
                    quantity=Decimal("0.1"),
                    entry_price=Decimal("100"),
                    exit_price=Decimal("110"),
                    opened_at=START + timedelta(minutes=10),
                    closed_at=START + timedelta(minutes=40),
                    stop_loss=Decimal("90"),
                    profit_target=Decimal("120"),
                    fees=Decimal("1"),
                    status=TradeStatus.closed,
                    time_basis="utc_aware",
                )
            )
        db.commit()
    print(f"seeded {TRADER} and {ADMIN} password={PASSWORD} BTCUSDT {START.isoformat()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
