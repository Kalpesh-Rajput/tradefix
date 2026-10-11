"""Bootstrap Monte Carlo of historical per-trade P&L.

Method: i.i.d. resampling with replacement of the selected trades' realized P&L.
Every path starts at 0 cumulative P&L (equity = starting balance) before trade 1.
Drawdown on a path = max over steps of (running peak - value), with the running
peak including the starting point, so a path that only falls still has a drawdown.

Assumptions (returned to the client verbatim): trades are independent and
identically distributed, sizing and market conditions stay as they were, and
streak/serial correlation is not modelled. Results describe the spread of
outcomes this history could produce if re-ordered; they are not a forecast.

Cache: results are keyed by a hash of the exact inputs (P&L sequence, horizon,
paths, seed, starting balance), so a cached result can never be stale.
"""

from __future__ import annotations

import hashlib
import struct
import threading
from collections import OrderedDict
from typing import Any, Sequence

import numpy as np

MIN_TRADES = 30
DEFAULT_PATHS = 2000
MAX_HORIZON = 1000
BAND_STEPS = 60
DEFAULT_SEED = 20_240_601
DRAWDOWN_THRESHOLDS_PCT = (10, 20, 30)
PERCENTILES = (5, 25, 50, 75, 95)

ASSUMPTIONS = [
    "Each simulated trade is drawn at random, with replacement, from your historical trade results.",
    "Trades are treated as independent; real streaks and changing market conditions are not modelled.",
    "Position sizing is assumed to stay the same as in the selected history.",
    "Results show a range of possible outcomes for the same number of trades, not a prediction.",
]

_CACHE_MAX = 128
_cache: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
_lock = threading.Lock()


def _cache_key(pnls: Sequence[float], horizon: int, paths: int, seed: int, start: float) -> str:
    h = hashlib.sha256()
    h.update(struct.pack("<iiid", horizon, paths, seed, float(start)))
    h.update(np.asarray(pnls, dtype=np.float64).tobytes())
    return h.hexdigest()


def cache_clear() -> None:
    with _lock:
        _cache.clear()


def cache_size() -> int:
    with _lock:
        return len(_cache)


def insufficient(reason: str, sample_size: int) -> dict[str, Any]:
    return {"status": "insufficient", "reason": reason, "sample_size": sample_size}


def simulate(
    pnls: Sequence[float],
    *,
    starting_balance: float | None,
    paths: int = DEFAULT_PATHS,
    seed: int = DEFAULT_SEED,
    max_horizon: int = MAX_HORIZON,
) -> dict[str, Any]:
    values = [float(p) for p in pnls]
    n = len(values)
    if n < MIN_TRADES:
        return insufficient(f"Needs at least {MIN_TRADES} closed trades to simulate; this range has {n}.", n)
    arr = np.asarray(values, dtype=np.float64)
    if not np.all(np.isfinite(arr)):
        return insufficient("Some trade results are not valid numbers.", n)
    if float(np.max(np.abs(arr))) == 0.0:
        return insufficient("Every trade in this range is breakeven, so there is nothing to simulate.", n)
    if paths < 100:
        raise ValueError("paths must be >= 100")

    horizon = min(n, max_horizon)
    start = float(starting_balance) if starting_balance and starting_balance > 0 else 0.0
    key = _cache_key(values, horizon, paths, seed, start)
    with _lock:
        hit = _cache.get(key)
        if hit is not None:
            _cache.move_to_end(key)
            return {**hit, "cached": True}

    rng = np.random.default_rng(seed)
    draws = rng.choice(arr, size=(paths, horizon), replace=True)
    cum = np.concatenate([np.zeros((paths, 1)), np.cumsum(draws, axis=1)], axis=1)
    peak = np.maximum.accumulate(cum, axis=1)
    max_dd = np.max(peak - cum, axis=1)
    final = cum[:, -1]

    step_idx = np.unique(np.linspace(0, horizon, num=min(BAND_STEPS + 1, horizon + 1)).round().astype(int))
    band_values = np.percentile(cum[:, step_idx], PERCENTILES, axis=0)

    hist = arr[-horizon:]
    hist_cum = np.concatenate([[0.0], np.cumsum(hist)])

    bands = []
    for j, step in enumerate(step_idx.tolist()):
        bands.append(
            {
                "step": int(step),
                "p5": round(float(band_values[0][j]), 2),
                "p25": round(float(band_values[1][j]), 2),
                "p50": round(float(band_values[2][j]), 2),
                "p75": round(float(band_values[3][j]), 2),
                "p95": round(float(band_values[4][j]), 2),
                "historical": round(float(hist_cum[step]), 2),
            }
        )

    def pct(values: np.ndarray) -> dict[str, float]:
        out = np.percentile(values, PERCENTILES)
        return {f"p{p}": round(float(v), 2) for p, v in zip(PERCENTILES, out)}

    thresholds = []
    if start > 0:
        for t in DRAWDOWN_THRESHOLDS_PCT:
            amount = start * t / 100.0
            thresholds.append(
                {
                    "threshold_pct": t,
                    "threshold_amount": round(amount, 2),
                    "probability": round(float(np.mean(max_dd >= amount)) * 100, 1),
                }
            )

    hist_peak = np.maximum.accumulate(hist_cum)
    result = {
        "status": "ok",
        "reason": None,
        "sample_size": n,
        "method": "bootstrap_iid",
        "paths": paths,
        "horizon": horizon,
        "horizon_capped": horizon < n,
        "seed": seed,
        "starting_balance": round(start, 2) if start > 0 else None,
        "bands": bands,
        "final_pnl": pct(final),
        "max_drawdown": pct(max_dd),
        "prob_loss": round(float(np.mean(final < 0)) * 100, 1),
        "drawdown_thresholds": thresholds,
        "historical_final_pnl": round(float(hist_cum[-1]), 2),
        "historical_max_drawdown": round(float(np.max(hist_peak - hist_cum)), 2),
        "assumptions": ASSUMPTIONS,
        "cached": False,
    }
    with _lock:
        _cache[key] = result
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)
    return result
