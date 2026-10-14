"""Simulated-trade exclusion for AI, RAG, broker-sync and import readers, plus unchanged results (1C)."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.ai_document import AiDocument
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.services import stats_service
from app.services.advanced_analytics import build_advanced
from app.services.advanced_analytics.core import Filters
from app.services.ai.agents.context import load_trades, tag_catalog
from app.services.ai.insights.engine import _load_trades as insight_trades
from app.services.ai.insights.snapshot import latest_closed_trade_at
from app.services.ai.rag.ingest import backfill_user_documents, ingest_trade
from app.services.ai.tools.analytics import get_trade_history, get_trade_statistics
from app.services.ai.tools.context import ToolContext
from app.services.imports.duplicates import existing_duplicate_keys
from app.services.ingestion.grouping import PositionDraft
from app.services.ingestion.persist import _upsert_journal
from tests.bt_support import db, make_account, make_user, requires_db  # noqa: F401

pytestmark = requires_db

BASE = datetime(2026, 3, 2, 14, 30, tzinfo=timezone.utc)
SIM = "SIMX"
CLOCK = re.compile(r"\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d\.\d+\+00:00")


def _trade(user, account, i: int, *, simulated=False, symbol="EURUSD", pnl=40.0):
    opened = BASE + timedelta(hours=i)
    return Trade(
        user_id=user.id,
        account_id=account.id,
        symbol=symbol,
        quantity=1,
        entry_price=Decimal("1.1"),
        exit_price=Decimal("1.2"),
        opened_at=opened,
        closed_at=opened + timedelta(minutes=30),
        pnl=pnl,
        fees=Decimal("1"),
        status=TradeStatus.closed,
        is_simulated=simulated,
        notes="simulated note" if simulated else "live note",
        setup_tags=["SIMTAG"] if simulated else ["ORB"],
        external_trade_id="POS-1" if simulated else None,
    )


@pytest.fixture()
def env(db):  # noqa: F811
    user = make_user(db)
    account = make_account(db, user)
    for i, pnl in enumerate([120, -60, 80, -40, 150]):
        db.add(_trade(user, account, i, pnl=pnl))
    db.flush()
    return SimpleNamespace(db=db, user=user, account=account)


def _add_sim(env):
    sim = _trade(env.user, env.account, 2, simulated=True, symbol=SIM, pnl=-999)
    env.db.add(sim)
    env.db.flush()
    return sim


def _snapshot(env) -> str:
    ctx = ToolContext(db=env.db, user_id=env.user.id, account_id=env.account.id)
    payload = {
        "full": stats_service.full_analytics(env.db, env.user.id, account_id=env.account.id),
        "advanced": build_advanced(env.db, env.db.get(User, env.user.id), env.account.id, Filters()),
        "ai_stats": get_trade_statistics(ctx, {}),
        "ai_history": get_trade_history(ctx, {}),
    }
    return CLOCK.sub("<now>", json.dumps(payload, sort_keys=True, default=str))


def test_results_unchanged_by_simulated_trades(env):
    before = _snapshot(env)
    _add_sim(env)
    after = _snapshot(env)
    assert before == after


def test_ai_context_and_tools(env):
    _add_sim(env)
    assert SIM not in {t.symbol for t in load_trades(env.db, env.user.id)}
    assert "SIMTAG" not in tag_catalog(env.db, env.user.id)
    assert SIM not in {t.symbol for t in insight_trades(env.db, env.user.id, None, None)}
    ctx = ToolContext(db=env.db, user_id=env.user.id)
    assert SIM not in json.dumps(get_trade_history(ctx, {}), default=str)


def test_snapshot_latest_closed_ignores_simulated(env):
    latest = latest_closed_trade_at(env.db, env.user.id, None)
    sim = _trade(env.user, env.account, 400, simulated=True, symbol=SIM)
    env.db.add(sim)
    env.db.flush()
    assert latest_closed_trade_at(env.db, env.user.id, None) == latest


def test_rag_never_embeds_simulated(env):
    sim = _add_sim(env)
    ingest_trade(env.db, sim)
    backfill_user_documents(env.db, env.user.id)
    env.db.flush()
    docs = env.db.query(AiDocument).filter(AiDocument.user_id == env.user.id).all()
    assert sim.id not in {d.source_id for d in docs}
    assert docs, "live trade notes should still be indexed"


def test_broker_sync_never_matches_simulated(env):
    sim = _add_sim(env)
    draft = PositionDraft(
        external_position_id="POS-1",
        provider_symbol="EURUSD",
        canonical="EURUSD",
        side="long",
        quantity=Decimal("1"),
        entry_price=Decimal("1.1"),
        exit_price=Decimal("1.2"),
        opened_at=BASE,
        closed_at=BASE + timedelta(minutes=10),
        commission=Decimal("0"),
        swap=Decimal("0"),
        funding=Decimal("0"),
        gross_pnl=Decimal("10"),
        net_pnl=Decimal("10"),
        currency="USD",
        status="closed",
    )
    sim.broker_account_id = uuid.uuid4()
    env.db.flush()
    with pytest.raises(IntegrityError), env.db.begin_nested():
        _upsert_journal(env.db, env.user.id, sim.broker_account_id, env.account.id, "binance", draft)
        env.db.flush()
    env.db.refresh(sim)
    assert sim.is_simulated and sim.symbol == SIM and float(sim.pnl) == -999


def test_import_dedup_ignores_simulated(env):
    _add_sim(env)
    keys = existing_duplicate_keys(env.db, env.user.id, env.account.id)
    assert "ext:POS-1" not in keys
