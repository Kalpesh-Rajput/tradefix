"""Gate 1 [NET]: after `seed-demo`, aggregated candles match an independent numpy calculation (`pytest -m seeded`)."""

from __future__ import annotations

import numpy as np
import pytest
from sqlalchemy.orm import Session

from app.services.marketdata.aggregation import TIMEFRAME_MINUTES, timeframe_ms
from app.services.marketdata.candle_service import get_candles
from app.services.marketdata.candles import Candles
from app.services.marketdata.coverage import covered_ranges
from app.services.marketdata.operations import SEED_SYMBOLS, previous_full_month
from app.services.marketdata.registry import get_instrument
from app.services.marketdata.store import get_store
from tests.bt_support import ENGINE, requires_db

pytestmark = [requires_db, pytest.mark.seeded]


def _reference(ts, o, h, l, c, v, step):  # noqa: E741
    buckets = ts - ts % step
    starts, first = np.unique(buckets, return_index=True)
    last = np.r_[first[1:], ts.size] - 1
    return {
        "ts": starts,
        "open": o[first],
        "high": np.maximum.reduceat(h, first),
        "low": np.minimum.reduceat(l, first),
        "close": c[last],
        "volume": np.add.reduceat(v, first),
    }


@pytest.mark.parametrize("symbol", SEED_SYMBOLS)
@pytest.mark.parametrize("timeframe", list(TIMEFRAME_MINUTES))
def test_seeded_aggregation_matches_reference(symbol, timeframe):
    spec = get_instrument(symbol)
    start, end = previous_full_month()
    with Session(ENGINE) as db:
        if not any(a <= start and b >= end for a, b in covered_ranges(db, spec.symbol, spec.source)):
            pytest.skip(f"{symbol} not seeded for the previous month; run seed-demo")
        step = timeframe_ms(timeframe)
        pages, cursor = [], start
        while cursor < end:
            window = get_candles(db, spec, timeframe, cursor, end)
            pages.append(window.candles)
            if not window.has_more_after:
                break
            cursor = int(window.candles.ts[-1]) + step
    raw = get_store().read(spec.source, spec.symbol, start, end)
    ref = _reference(raw.ts, raw.open, raw.high, raw.low, raw.close, raw.volume, step)
    got = Candles.concat(*pages)
    assert got.ts.tolist() == ref["ts"].tolist()
    for column in ("open", "high", "low", "close", "volume"):
        np.testing.assert_allclose(getattr(got, column), ref[column], rtol=1e-12)
