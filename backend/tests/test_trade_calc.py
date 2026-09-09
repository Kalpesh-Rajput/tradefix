from datetime import datetime, timezone

from app.services.trade_calc import (
    calculate_crypto_position_value,
    calculate_equity_risk,
    calculate_exit_pnl,
    calculate_forex_margin,
    calculate_forex_risk,
    calculate_futures_risk,
    calculate_options_value,
    calculate_trade,
    display_status,
    margin_used,
    position_value,
)


OPENED = datetime(2026, 3, 1, 14, 30, tzinfo=timezone.utc)


def test_equity_long_risk():
    assert calculate_equity_risk(side="long", quantity=1, entry_price=87, stop_loss=80) == 7


def test_equity_short_risk():
    assert calculate_equity_risk(side="short", quantity=1, entry_price=87, stop_loss=94) == 7


def test_equity_risk_never_negative():
    assert calculate_equity_risk(side="long", quantity=1, entry_price=87, stop_loss=90) == 0
    assert calculate_equity_risk(side="short", quantity=1, entry_price=87, stop_loss=80) == 0


def test_equity_risk_missing_stop():
    assert calculate_equity_risk(side="long", quantity=1, entry_price=87, stop_loss=None) is None


def test_equity_position_and_calc():
    calc = calculate_trade(
        asset_type="stock",
        symbol="AAPL",
        side="long",
        opened_at=OPENED,
        quantity=100,
        entry_price=87,
        stop_loss=80,
    )
    assert calc.position_value == 8700
    assert calc.invested_amount == 8700
    assert calc.margin_used is None
    assert calc.risk_amount == 700


def test_forex_margin_not_risk():
    pos = position_value(asset_type="forex", symbol="EURUSD", quantity=1, entry_price=1.085)
    assert pos == 108500
    assert calculate_forex_margin(position_size=pos, leverage=100) == 1085
    assert calculate_forex_margin(position_size=pos, leverage=10) == 10850
    assert calculate_forex_margin(position_size=pos, leverage=1) == 108500


def test_forex_leverage_does_not_multiply_risk():
    risk_100 = calculate_forex_risk(
        side="long", symbol="EURUSD", lots=1, entry_price=1.0850, stop_loss=1.0800, contract_size=100_000
    )
    risk_1 = calculate_forex_risk(
        side="long", symbol="EURUSD", lots=1, entry_price=1.0850, stop_loss=1.0800, contract_size=100_000
    )
    assert risk_100 == 500
    assert risk_1 == 500


def test_forex_usdjpy_quote_conversion():
    risk = calculate_forex_risk(
        side="long", symbol="USDJPY", lots=1, entry_price=150.00, stop_loss=149.00, contract_size=100_000
    )
    assert risk == 666.67


def test_forex_calc_split_position_margin_risk():
    calc = calculate_trade(
        asset_type="forex",
        symbol="EURUSD",
        side="long",
        opened_at=OPENED,
        quantity=1,
        entry_price=1.085,
        stop_loss=1.080,
        leverage=100,
    )
    assert calc.position_value == 108500
    assert calc.margin_used == 1085
    assert calc.risk_amount == 500
    assert calc.invested_amount == 1085


def test_forex_wrong_screenshot_numbers_are_not_reproduced():
    calc = calculate_trade(
        asset_type="stock",
        symbol="AAPL",
        side="long",
        opened_at=OPENED,
        quantity=1,
        entry_price=87,
        stop_loss=80,
        leverage=100,
    )
    assert calc.invested_amount == 87
    assert calc.risk_amount == 7
    assert calc.position_value == 87


def test_crypto_spot_and_leveraged():
    assert calculate_crypto_position_value(0.25, 100000) == 25000
    spot = margin_used(
        asset_type="crypto", symbol="BTCUSD", quantity=0.25, entry_price=100000, leverage=1
    )
    lev = margin_used(
        asset_type="crypto", symbol="BTCUSD", quantity=0.25, entry_price=100000, leverage=10
    )
    assert spot == 25000
    assert lev == 2500
    calc = calculate_trade(
        asset_type="crypto",
        symbol="BTCUSD",
        side="long",
        opened_at=OPENED,
        quantity=0.25,
        entry_price=100000,
        stop_loss=96000,
        leverage=10,
    )
    assert calc.position_value == 25000
    assert calc.margin_used == 2500
    assert calc.risk_amount == 1000


def test_crypto_short_risk():
    calc = calculate_trade(
        asset_type="crypto",
        symbol="ETHUSD",
        side="short",
        opened_at=OPENED,
        quantity=2,
        entry_price=3000,
        stop_loss=3150,
        leverage=5,
    )
    assert calc.risk_amount == 300
    assert calc.margin_used == 1200


def test_options_contract_value():
    assert calculate_options_value(2, 75, 120) == 18000


def test_options_long_call_invested_and_pnl():
    calc = calculate_trade(
        asset_type="option",
        symbol="AAPL",
        side="long",
        opened_at=OPENED,
        quantity=2,
        entry_price=120,
        exit_price=140,
        sell_quantity=2,
        contract_size=75,
        stop_loss=80,
    )
    assert calc.position_value == 18000
    assert calc.invested_amount == 18000
    assert calc.premium_received is None
    assert calc.risk_amount == 6000
    assert calc.pnl == 3000


def test_options_short_put_premium_received():
    calc = calculate_trade(
        asset_type="option",
        symbol="SPY",
        side="short",
        opened_at=OPENED,
        quantity=1,
        entry_price=4.5,
        exit_price=2.0,
        sell_quantity=1,
        contract_size=100,
    )
    assert calc.position_value == 450
    assert calc.invested_amount == 0
    assert calc.premium_received == 450
    assert calc.pnl == 250


def test_futures_contract_size_risk():
    risk = calculate_futures_risk(
        side="long",
        contracts=1,
        entry_price=5200,
        stop_loss=5190,
        contract_size=50,
    )
    assert risk == 500


def test_futures_tick_value_risk():
    risk = calculate_futures_risk(
        side="short",
        contracts=2,
        entry_price=5200,
        stop_loss=5210,
        tick_size=0.25,
        tick_value=12.5,
    )
    assert risk == 1000


def test_futures_calc_position():
    calc = calculate_trade(
        asset_type="future",
        symbol="ES",
        side="long",
        opened_at=OPENED,
        quantity=2,
        entry_price=5200,
        stop_loss=5190,
        contract_size=50,
        tick_size=0.25,
        tick_value=12.5,
    )
    assert calc.position_value == 520000
    assert calc.risk_amount == 1000
    assert calc.margin_used == 24000


def test_exits_none_open():
    calc = calculate_trade(
        asset_type="stock",
        symbol="AAPL",
        side="long",
        opened_at=OPENED,
        quantity=100,
        entry_price=90,
    )
    assert calc.sell_quantity == 0
    assert calc.remaining_quantity == 100
    assert calc.display_status == "open"
    assert calc.status == "open"
    assert calc.pnl is None


def test_exits_partial_and_full():
    from app.services.trade_calc import Fill

    partial = calculate_trade(
        asset_type="stock",
        symbol="AAPL",
        side="long",
        opened_at=OPENED,
        fills=[
            Fill("entry", 100, 90, OPENED),
            Fill("exit", 25, 94, OPENED),
            Fill("exit", 25, 96, OPENED),
        ],
    )
    assert partial.display_status == "partially_closed"
    assert partial.remaining_quantity == 50
    assert partial.pnl == 250
    assert partial.status == "open"

    closed = calculate_trade(
        asset_type="stock",
        symbol="AAPL",
        side="long",
        opened_at=OPENED,
        fills=[
            Fill("entry", 100, 90, OPENED),
            Fill("exit", 25, 90, OPENED),
            Fill("exit", 25, 94, OPENED),
            Fill("exit", 50, 100, OPENED),
        ],
        fees=10,
    )
    assert closed.display_status == "closed"
    assert closed.remaining_quantity == 0
    assert closed.status == "closed"
    assert closed.pnl == 590


def test_over_exit_remaining_clamped():
    from app.services.trade_calc import Fill

    calc = calculate_trade(
        asset_type="stock",
        symbol="MSFT",
        side="long",
        opened_at=OPENED,
        fills=[
            Fill("entry", 10, 100, OPENED),
            Fill("exit", 12, 110, OPENED),
        ],
    )
    assert calc.remaining_quantity == 0
    assert calc.display_status == "closed"


def test_display_status_helper():
    assert display_status(10, 0) == "open"
    assert display_status(5, 5) == "partially_closed"
    assert display_status(0, 10) == "closed"


def test_exit_pnl_short_equity():
    pnl = calculate_exit_pnl(
        asset_type="stock",
        symbol="TSLA",
        side="short",
        quantity=10,
        entry_price=200,
        exit_price=180,
    )
    assert pnl == 200


# ---------------------------------------------------------------------------
# Forex golden regressions — freeze current trade_calc behavior (lots model).
# quantity / sell_quantity are lots; do not “fix” unusual-looking results.
# ---------------------------------------------------------------------------


def _load_forex_fixtures():
    import json
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "fixtures" / "forex_calc.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _run_fixture_case(case: dict):
    from datetime import datetime

    from app.services.trade_calc import Fill, calculate_trade

    opened = datetime.fromisoformat(_load_forex_fixtures()["opened_at"])
    kwargs = {
        "asset_type": case["asset_type"],
        "symbol": case["symbol"],
        "side": case["side"],
        "opened_at": opened,
        "leverage": case.get("leverage"),
        "fees": case.get("fees", 0),
        "stop_loss": case.get("stop_loss"),
    }
    if "fills" in case:
        kwargs["fills"] = [
            Fill(
                leg_type=f["leg_type"],
                quantity=f["quantity"],
                price=f["price"],
                executed_at=opened,
                fees=float(f.get("fees") or 0),
            )
            for f in case["fills"]
        ]
    else:
        kwargs["quantity"] = case.get("quantity")
        kwargs["entry_price"] = case.get("entry_price")
        kwargs["exit_price"] = case.get("exit_price")
        kwargs["sell_quantity"] = case.get("sell_quantity")
    return calculate_trade(**kwargs)


def test_forex_golden_fixtures():
    data = _load_forex_fixtures()
    for case in data["cases"]:
        calc = _run_fixture_case(case)
        expect = case["expect"]
        for key, value in expect.items():
            actual = getattr(calc, key)
            assert actual == value, f"{case['id']}.{key}: expected {value}, got {actual}"


def test_forex_leverage_changes_margin_not_pnl_or_risk():
    a = _run_fixture_case(next(c for c in _load_forex_fixtures()["cases"] if c["id"] == "eurusd_leverage_100"))
    b = _run_fixture_case(next(c for c in _load_forex_fixtures()["cases"] if c["id"] == "eurusd_leverage_10"))
    assert a.pnl == b.pnl == 500.0
    assert a.risk_amount == b.risk_amount == 500.0
    assert a.margin_used != b.margin_used
    assert a.margin_used == 1100.0
    assert b.margin_used == 11000.0


def test_forex_exit_breakdown_matches_aggregate():
    from app.services.trade_calc import Fill, calculate_exit_pnl_breakdown

    opened = OPENED
    fills = [
        Fill("entry", 1.0, 1.1, opened),
        Fill("exit", 0.25, 1.105, opened, fees=2),
        Fill("exit", 0.75, 1.11, opened, fees=3),
    ]
    calc = calculate_trade(
        asset_type="forex",
        symbol="EURUSD",
        side="long",
        opened_at=opened,
        fills=fills,
        fees=5,
        leverage=100,
    )
    breakdown = calculate_exit_pnl_breakdown(
        asset_type="forex",
        symbol="EURUSD",
        side="long",
        entry_quantity=1.0,
        entry_price=1.1,
        exits=[f for f in fills if f.leg_type == "exit"],
        trade_fees=5,
        contract_size=100_000,
    )
    assert len(breakdown.legs) == 2
    assert round(breakdown.legs[0].gross, 2) == 125.0
    assert round(breakdown.legs[1].gross, 2) == 750.0
    assert breakdown.realized_gross == 875.0
    assert calc.realized_gross == 875.0
    assert calc.pnl == round(875.0 - 10.0, 2)  # trade 5 + leg 5
    assert calc.exit_legs[0].net == round(125.0 - 2, 2)


def test_forex_symbol_aliases_lookup():
    from app.services.instruments import default_contract_size, get_instrument, quote_currency

    for alias in ("GOLD", "XAU", "gold", "XAU/USD"):
        inst = get_instrument("forex", alias)
        assert inst is not None
        assert inst.symbol == "XAUUSD"
        assert default_contract_size("forex", alias) == 100
        assert quote_currency(alias) == "USD"
    for alias in ("SILVER", "XAG", "silver"):
        inst = get_instrument("forex", alias)
        assert inst is not None
        assert inst.symbol == "XAGUSD"
        assert default_contract_size("forex", alias) == 5000
