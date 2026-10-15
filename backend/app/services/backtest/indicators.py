"""Vectorized indicators. None of them read a bar after the one they label.

Warm-up values are NaN. EMA, RSI, ATR and ADX use Wilder's seed: a simple average of the
first `period` observations, then the recursive smooth.
"""

from __future__ import annotations

import numpy as np

from app.core.config import settings


def _period(period: int) -> int:
    if period < settings.indicator_period_min or period > settings.indicator_period_max:
        raise ValueError(f"period must be between {settings.indicator_period_min} and {settings.indicator_period_max}")
    return period


def _nan(n: int) -> np.ndarray:
    return np.full(n, np.nan, dtype=float)


def sma(values: np.ndarray, period: int) -> np.ndarray:
    period = _period(period)
    out = _nan(len(values))
    if len(values) < period:
        return out
    window = np.cumsum(values, dtype=float)
    window[period:] = window[period:] - window[:-period]
    out[period - 1 :] = window[period - 1 :] / period
    return out


def ema(values: np.ndarray, period: int) -> np.ndarray:
    period = _period(period)
    out = _nan(len(values))
    if len(values) < period:
        return out
    seed = float(np.mean(values[:period]))
    out[period - 1] = seed
    alpha = 2.0 / (period + 1.0)
    for i in range(period, len(values)):
        out[i] = alpha * values[i] + (1.0 - alpha) * out[i - 1]
    return out


def _wilder(values: np.ndarray, period: int) -> np.ndarray:
    out = _nan(len(values))
    if len(values) < period:
        return out
    out[period - 1] = float(np.sum(values[:period]))
    for i in range(period, len(values)):
        out[i] = out[i - 1] - out[i - 1] / period + values[i]
    return out


def rsi(close: np.ndarray, period: int) -> np.ndarray:
    period = _period(period)
    out = _nan(len(close))
    if len(close) <= period:
        return out
    change = np.diff(close, prepend=close[0])
    change[0] = 0.0
    gain = np.clip(change, 0, None)
    loss = np.clip(-change, 0, None)
    avg_gain = _wilder(gain[1:], period) / period
    avg_loss = _wilder(loss[1:], period) / period
    # _wilder indexes the first change at 0, which is close[1] - close[0]. Shift back onto close indexes.
    shifted_gain = _nan(len(close))
    shifted_loss = _nan(len(close))
    shifted_gain[1:] = avg_gain
    shifted_loss[1:] = avg_loss
    with np.errstate(divide="ignore", invalid="ignore"):
        rs = shifted_gain / shifted_loss
        out = 100.0 - 100.0 / (1.0 + rs)
    out[(shifted_loss == 0) & (shifted_gain > 0)] = 100.0
    out[(shifted_gain == 0) & (shifted_loss == 0)] = 50.0
    out[np.isnan(shifted_gain)] = np.nan
    return out


def macd(close: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> dict[str, np.ndarray]:
    fast_line = ema(close, fast)
    slow_line = ema(close, slow)
    line = fast_line - slow_line
    # Signal EMA is seeded on the first `signal` finite MACD values.
    finite = np.isfinite(line)
    sig = _nan(len(close))
    if finite.sum() >= signal:
        start = int(np.argmax(finite))
        segment = line[start:]
        seeded = ema(segment, signal)
        sig[start:] = seeded
    hist = line - sig
    return {"line": line, "signal": sig, "histogram": hist}


def atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int) -> np.ndarray:
    period = _period(period)
    prev = np.roll(close, 1)
    prev[0] = close[0]
    tr = np.maximum(high - low, np.maximum(np.abs(high - prev), np.abs(low - prev)))
    tr[0] = high[0] - low[0]
    smoothed = _wilder(tr, period)
    out = _nan(len(close))
    valid = np.isfinite(smoothed)
    out[valid] = smoothed[valid] / period
    return out


def bollinger(close: np.ndarray, period: int, deviations: float = 2.0) -> dict[str, np.ndarray]:
    period = _period(period)
    middle = sma(close, period)
    out_std = _nan(len(close))
    if len(close) >= period:
        for i in range(period - 1, len(close)):
            out_std[i] = float(np.std(close[i - period + 1 : i + 1], ddof=0))
    return {"middle": middle, "upper": middle + deviations * out_std, "lower": middle - deviations * out_std}


def stochastic(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int, smooth: int = 3) -> dict[str, np.ndarray]:
    period = _period(period)
    smooth = _period(smooth)
    k = _nan(len(close))
    for i in range(period - 1, len(close)):
        highest = float(np.max(high[i - period + 1 : i + 1]))
        lowest = float(np.min(low[i - period + 1 : i + 1]))
        span = highest - lowest
        k[i] = 50.0 if span == 0 else 100.0 * (close[i] - lowest) / span
    return {"k": k, "d": sma_ignore_nan(k, smooth)}


def sma_ignore_nan(values: np.ndarray, period: int) -> np.ndarray:
    out = _nan(len(values))
    for i in range(period - 1, len(values)):
        window = values[i - period + 1 : i + 1]
        if np.isfinite(window).all():
            out[i] = float(np.mean(window))
    return out


def adx(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int) -> dict[str, np.ndarray]:
    period = _period(period)
    n = len(close)
    plus_dm = np.zeros(n)
    minus_dm = np.zeros(n)
    up = np.diff(high, prepend=high[0])
    down = -np.diff(low, prepend=low[0])
    up[0] = 0.0
    down[0] = 0.0
    plus_dm[(up > down) & (up > 0)] = up[(up > down) & (up > 0)]
    minus_dm[(down > up) & (down > 0)] = down[(down > up) & (down > 0)]
    prev = np.roll(close, 1)
    prev[0] = close[0]
    tr = np.maximum(high - low, np.maximum(np.abs(high - prev), np.abs(low - prev)))
    tr[0] = high[0] - low[0]
    atr_sum = _wilder(tr, period)
    plus_sum = _wilder(plus_dm, period)
    minus_sum = _wilder(minus_dm, period)
    with np.errstate(divide="ignore", invalid="ignore"):
        plus_di = 100.0 * plus_sum / atr_sum
        minus_di = 100.0 * minus_sum / atr_sum
        dx = 100.0 * np.abs(plus_di - minus_di) / (plus_di + minus_di)
    dx[~np.isfinite(plus_di)] = np.nan
    # ADX is the Wilder smooth of DX, seeded once `period` DX values exist.
    adx_line = _nan(n)
    finite_at = np.flatnonzero(np.isfinite(dx))
    if len(finite_at) >= period:
        first = int(finite_at[0])
        segment = np.nan_to_num(dx[first:], nan=0.0)
        # Use only the finite run. Seed at first + period - 1.
        seed_index = first + period - 1
        if seed_index < n:
            adx_line[seed_index] = float(np.mean(dx[first : seed_index + 1]))
            for i in range(seed_index + 1, n):
                if not np.isfinite(dx[i]):
                    break
                adx_line[i] = (adx_line[i - 1] * (period - 1) + dx[i]) / period
    return {"adx": adx_line, "plus_di": plus_di, "minus_di": minus_di}


def highest(high: np.ndarray, period: int) -> np.ndarray:
    period = _period(period)
    out = _nan(len(high))
    for i in range(period - 1, len(high)):
        out[i] = float(np.max(high[i - period + 1 : i + 1]))
    return out


def lowest(low: np.ndarray, period: int) -> np.ndarray:
    period = _period(period)
    out = _nan(len(low))
    for i in range(period - 1, len(low)):
        out[i] = float(np.min(low[i - period + 1 : i + 1]))
    return out
