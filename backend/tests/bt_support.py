"""Shared helpers for backtesting tests: real Postgres in a rolled-back transaction."""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings


def _engine():
    try:
        engine = create_engine(settings.database_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("select 1"))
        return engine
    except Exception:  # pragma: no cover - environment dependent
        return None


ENGINE = _engine()
requires_db = pytest.mark.skipif(ENGINE is None, reason="Postgres not reachable")


@pytest.fixture()
def db():
    """A session whose work is rolled back at the end of the test (savepoints for inner commits)."""
    conn = ENGINE.connect()
    tx = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        tx.rollback()
        conn.close()


def make_user(db: Session, **kw):
    from app.models.user import User

    user = User(email=f"bt-{uuid4()}@test.local", name=kw.pop("name", "Tester"), timezone=kw.pop("timezone", "UTC"), **kw)
    db.add(user)
    db.flush()
    return user


def make_account(db: Session, user, name: str = "Main"):
    from app.models.account import Account

    account = Account(user_id=user.id, name=name, initial_balance=Decimal("10000"))
    db.add(account)
    db.flush()
    return account
