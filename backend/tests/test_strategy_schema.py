"""Strategy definitions reject unknown fields and enforce the configured limits (backtesting 4A)."""

import pytest
from pydantic import ValidationError

from app.services.backtest.strategy_schema import parse_strategy


def _payload(**overrides):
    body = {
        "schema_version": 1,
        "name": "MA cross",
        "market": {"symbol": "BTCUSDT", "timeframe": "1h", "start_ms": 0, "end_ms": 3_600_000},
        "direction": "long",
        "long_entry": {
            "combine": "all",
            "conditions": [
                {
                    "left": {"kind": "indicator", "name": "sma", "period": 10, "output": "value"},
                    "operator": "crosses_above",
                    "right": {"kind": "indicator", "name": "sma", "period": 20, "output": "value"},
                }
            ],
        },
        "stop_loss": {"type": "pips", "value": 20},
        "take_profit": {"type": "r", "value": 2},
        "risk": {"initial_balance": 10000, "risk_percent": 1},
    }
    body.update(overrides)
    return body


def test_accepts_a_long_crossover():
    definition = parse_strategy(_payload())
    assert definition.name == "MA cross"
    assert definition.long_entry.conditions[0].operator == "crosses_above"


def test_rejects_unknown_fields_and_bad_bounds():
    with pytest.raises(ValidationError):
        parse_strategy(_payload(surprise=True))
    with pytest.raises(ValidationError):
        parse_strategy(_payload(long_entry={
            "combine": "all",
            "conditions": [
                {
                    "left": {"kind": "indicator", "name": "sma", "period": 1},
                    "operator": "gt",
                    "right": {"kind": "constant", "value": 1},
                }
            ],
        }))
    with pytest.raises(ValidationError):
        parse_strategy(_payload(direction="short"))
    with pytest.raises(ValidationError):
        parse_strategy(_payload(risk={"initial_balance": 1000, "risk_percent": 1, "fixed_size": 1}))


def test_condition_cap():
    conditions = [
        {
            "left": {"kind": "price", "field": "close"},
            "operator": "gt",
            "right": {"kind": "constant", "value": i},
        }
        for i in range(11)
    ]
    with pytest.raises(ValidationError):
        parse_strategy(_payload(long_entry={"combine": "all", "conditions": conditions}))
