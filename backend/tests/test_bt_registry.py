from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.models.market_data import Instrument
from app.services.marketdata import registry
from tests.bt_support import db, requires_db  # noqa: F401

GOOD = """
instruments:
- {symbol: EURUSD, asset_class: forex, source: dukascopy, provider_id: eurusd, pip_size: 0.0001, contract_size: 100000, quote_currency: USD, price_decimals: 5, preload_years: 2}
- {symbol: BTCUSDT, asset_class: crypto, source: binance, provider_id: BTCUSDT, pip_size: 0.01, contract_size: 1, quote_currency: USDT, price_decimals: 2, preload_years: 2}
"""


def test_shipped_registry_is_valid_and_disabled_until_verified():
    specs = registry.parse_registry(registry.REGISTRY_PATH.read_text(encoding="utf-8"))
    assert {"EURUSD", "XAUUSD", "BTCUSDT", "BTCUSDT_PERP"} <= {s.symbol for s in specs}
    for spec in specs:
        assert spec.enabled is False or spec.verified_on is not None, spec.symbol


def test_parse_good():
    specs = registry.parse_registry(GOOD)
    assert [s.symbol for s in specs] == ["EURUSD", "BTCUSDT"]
    assert specs[0].enabled is False and specs[0].market_type == "spot"


@pytest.mark.parametrize(
    "bad",
    [
        GOOD + "- {symbol: EURUSD, asset_class: forex, source: dukascopy, provider_id: x, pip_size: 1, contract_size: 1, quote_currency: USD, price_decimals: 1, preload_years: 1}\n",
        GOOD.replace("pip_size: 0.0001", "pip_size: 0"),
        GOOD.replace("asset_class: forex", "asset_class: stock"),
        GOOD.replace("preload_years: 2}", "preload_years: 2, surprise: 1}", 1),
        GOOD.replace("source: dukascopy, provider_id: eurusd,", "source: dukascopy, provider_id: eurusd, market_type: usdm_futures,"),
    ],
)
def test_parse_rejects(bad):
    with pytest.raises(ValidationError):
        registry.parse_registry(bad)


def test_mark_verified_roundtrip(tmp_path: Path):
    path = tmp_path / "instruments.yaml"
    path.write_text(GOOD, encoding="utf-8")
    spec = registry.mark_verified("BTCUSDT", date(2026, 10, 1), path)
    assert spec.enabled and spec.verified_on == date(2026, 10, 1)
    reparsed = registry.parse_registry(path.read_text(encoding="utf-8"))
    assert reparsed[1].verified_on == date(2026, 10, 1) and reparsed[1].enabled
    assert reparsed[0].enabled is False


@requires_db
def test_mirror_is_idempotent(db, tmp_path: Path):  # noqa: F811
    path = tmp_path / "instruments.yaml"
    path.write_text(GOOD, encoding="utf-8")
    registry.reload_registry()
    assert registry.mirror_to_db(db, path) == 2
    assert registry.mirror_to_db(db, path) == 2
    row = db.get(Instrument, "EURUSD")
    assert row.pip_size == 0.0001 and row.source == "dukascopy"
    registry.reload_registry()
