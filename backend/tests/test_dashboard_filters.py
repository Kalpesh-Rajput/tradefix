from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.dashboard_filters import build_dashboard_filters, journal_filters_active
from app.schemas.trade_export import TradeExportFilters
from app.services.stats_service import apply_journal_filters

OPENED = datetime(2026, 10, 5, 14, 30, tzinfo=timezone.utc)


def _trade(**overrides):
    base = dict(
        symbol="AAPL",
        asset_type="stock",
        side="long",
        quantity=10,
        entry_price=100,
        exit_price=110,
        opened_at=OPENED,
        closed_at=OPENED,
        pnl=95.5,
        fees=4.5,
        risk_amount=50,
        setup_tag="Breakout",
        setup_tags=["Breakout"],
        strategy_name="Breakout",
        emotion_tags=["Confident"],
        mood="Calm",
        notes="held",
        rules_broken=[],
        screenshot_urls=[],
        status="closed",
        session="NY",
        rating=4,
        invested_amount=1000,
        extra={"moods": ["Calm"]},
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_inactive_advance_filter_is_ignored():
    scope = build_dashboard_filters()
    assert scope.filters is None
    assert scope.pnl_mode == "net"
    trades = [_trade(), _trade(symbol="MSFT")]
    assert apply_journal_filters(trades, None, "net") == trades


def test_symbol_and_status_filters_match_trade_view():
    scope = build_dashboard_filters(adv_symbol="aapl", adv_status="closed")
    assert scope.filters is not None
    assert journal_filters_active(scope.filters)
    aapl = _trade()
    msft = _trade(symbol="MSFT")
    kept = apply_journal_filters([aapl, msft], scope.filters, "net")
    assert kept == [aapl]
    assert apply_journal_filters([aapl], TradeExportFilters(status="open"), "net") == []


def test_pnl_filter_uses_gross_display_mode():
    loser_net = _trade(pnl=-2, fees=5, invested_amount=100)
    scope = build_dashboard_filters(adv_pnl="profit", pnl_mode="gross")
    assert apply_journal_filters([loser_net], scope.filters, scope.pnl_mode) == [loser_net]
    net_scope = build_dashboard_filters(adv_pnl="profit", pnl_mode="net")
    assert apply_journal_filters([loser_net], net_scope.filters, net_scope.pnl_mode) == []


def test_invalid_advance_filter_is_rejected():
    with pytest.raises(HTTPException) as exc:
        build_dashboard_filters(adv_status="pending")
    assert exc.value.status_code == 422
    with pytest.raises(HTTPException) as today_exc:
        build_dashboard_filters(adv_symbol="ES", adv_today="13-10-2026")
    assert today_exc.value.status_code == 422
