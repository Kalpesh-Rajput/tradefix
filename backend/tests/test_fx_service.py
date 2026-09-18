from datetime import datetime, timezone

import httpx
import pytest
from fastapi import HTTPException

from app.services import fx_service
from app.services.fx_service import FxTable, convert_amount, display_rate, pair_rate, _parse_provider


def _table() -> FxTable:
    return FxTable(
        base="USD",
        rates={"INR": 83.42, "EUR": 0.92, "GBP": 0.78, "JPY": 149.5, "AUD": 1.51, "CAD": 1.36},
        rate_timestamp=datetime(2026, 9, 18, 0, 0, 1, tzinfo=timezone.utc),
        fetched_at=datetime(2026, 9, 18, 9, 47, 12, tzinfo=timezone.utc),
        source="ExchangeRate-API",
        attribution="Rates by ExchangeRate-API.com",
        delayed=True,
    )


@pytest.fixture(autouse=True)
def _clear_cache():
    fx_service.reset_cache()
    yield
    fx_service.reset_cache()


def test_usd_to_inr():
    assert pair_rate(_table(), "USD", "INR") == pytest.approx(83.42)


def test_inr_to_usd():
    assert pair_rate(_table(), "INR", "USD") == pytest.approx(1 / 83.42)


def test_eur_to_usd():
    assert pair_rate(_table(), "EUR", "USD") == pytest.approx(1 / 0.92)


def test_eur_to_inr_cross():
    assert pair_rate(_table(), "EUR", "INR") == pytest.approx(83.42 / 0.92)


def test_same_currency_is_one():
    assert pair_rate(_table(), "usd", "USD") == 1.0


def test_swap_inverts_rate():
    usd_inr = pair_rate(_table(), "USD", "INR")
    inr_usd = pair_rate(_table(), "INR", "USD")
    assert usd_inr * inr_usd == pytest.approx(1.0)


def test_decimal_and_large_amounts():
    rate = pair_rate(_table(), "USD", "INR")
    assert convert_amount(1000, rate) == pytest.approx(83420)
    assert convert_amount(1000.50, rate) == pytest.approx(83461.71)
    assert convert_amount(1_000_000.25, rate) == pytest.approx(83.42 * 1_000_000.25)


def test_jpy_zero_decimal_amount_still_full_precision_internally():
    rate = pair_rate(_table(), "USD", "JPY")
    raw = convert_amount(12.34, rate)
    assert raw == pytest.approx(12.34 * 149.5)


def test_parse_provider_timestamps():
    table = _parse_provider(
        {
            "result": "success",
            "base_code": "USD",
            "time_last_update_unix": 1758182100,
            "rates": {"INR": 83.42, "EUR": 0.92},
        }
    )
    assert table.base == "USD"
    assert table.delayed is True
    assert table.rate_timestamp is not None
    assert table.rate_timestamp.tzinfo is not None
    assert table.fetched_at.tzinfo is not None
    assert "ExchangeRate-API" in table.source


def test_display_rate_precision():
    assert display_rate(83.42) == "83.42"
    assert display_rate(1.1801) == "1.1801"
    assert display_rate(0.56) == "0.5600"
    assert display_rate(0.004321) == "0.004321"


def test_invalid_currency():
    with pytest.raises(HTTPException) as exc:
        pair_rate(_table(), "USD", "ZZZ")
    assert exc.value.status_code == 400


def test_quote_uses_cache(monkeypatch):
    fetches = {"n": 0}

    def fake_fetch(client=None):
        fetches["n"] += 1
        return _table()

    monkeypatch.setattr(fx_service, "fetch_usd_table", fake_fetch)
    first = fx_service.get_quote("USD", "INR")
    second = fx_service.get_quote("USD", "EUR")
    assert fetches["n"] == 1
    assert first.freshness == "latest"
    assert second.freshness == "cached"
    assert second.rate == pytest.approx(0.92)


def test_stale_rate_when_provider_fails(monkeypatch):
    monkeypatch.setattr(fx_service, "fetch_usd_table", lambda client=None: _table())
    fx_service.get_quote("USD", "INR")

    def boom(client=None):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(fx_service, "fetch_usd_table", boom)
    stale = fx_service.get_quote("USD", "INR", force_refresh=True)
    assert stale.freshness == "stale"
    assert stale.rate == pytest.approx(83.42)
    assert stale.rate_timestamp is not None


def test_failure_without_cache(monkeypatch):
    def boom(client=None):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(fx_service, "fetch_usd_table", boom)
    with pytest.raises(HTTPException) as exc:
        fx_service.get_quote("USD", "INR")
    assert exc.value.status_code == 503


def test_refresh_bypasses_cache(monkeypatch):
    fetches = {"n": 0}

    def fake_fetch(client=None):
        fetches["n"] += 1
        table = _table()
        table.rates = {**table.rates, "INR": 80.0 + fetches["n"]}
        return table

    monkeypatch.setattr(fx_service, "fetch_usd_table", fake_fetch)
    a = fx_service.get_quote("USD", "INR")
    b = fx_service.get_quote("USD", "INR", force_refresh=True)
    assert fetches["n"] == 2
    assert a.rate != b.rate
    assert b.freshness == "latest"


def test_invalid_code_rejected():
    with pytest.raises(HTTPException) as exc:
        fx_service.get_quote("US", "INR")
    assert exc.value.status_code == 400
