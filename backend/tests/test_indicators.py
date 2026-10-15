"""Reference values for the indicators we implement ourselves (backtesting 4A)."""

import numpy as np
import pytest

from app.services.backtest.indicators import adx, atr, bollinger, ema, highest, lowest, macd, rsi, sma, stochastic


def test_sma_and_ema_on_a_ramp():
    close = np.array([1.0, 2, 3, 4, 5])
    assert np.isnan(sma(close, 3)[:2]).all()
    assert sma(close, 3)[2:].tolist() == pytest.approx([2, 3, 4])
    # Seed is the mean of the first 3 closes (2). Alpha for period 3 is 0.5, so the ramp stays on the close.
    assert ema(close, 3)[2:].tolist() == pytest.approx([2, 3, 4])


def test_rsi_wilder():
    close = np.array([10.0, 11, 12, 13, 11])
    values = rsi(close, 2)
    assert np.isnan(values[0])
    assert values[2] == pytest.approx(100)
    assert values[3] == pytest.approx(100)
    # Next bar: avg gain (1 + 0) / 2 = 0.5, avg loss (0 + 2) / 2 = 1 -> 100 - 100 / 1.5
    assert values[4] == pytest.approx(100 - 100 / 1.5)


def test_atr_and_bands():
    high = np.array([1.0, 2, 3])
    low = np.array([0.0, 1, 2])
    close = np.array([0.5, 1.5, 2.5])
    assert atr(high, low, close, 2)[1] == pytest.approx(1.25)
    assert atr(high, low, close, 2)[2] == pytest.approx(1.375)
    bands = bollinger(np.array([1.0, 3, 5]), 2, 2)
    assert bands["middle"][1] == pytest.approx(2)
    assert bands["upper"][1] == pytest.approx(4)
    assert bands["lower"][1] == pytest.approx(0)


def test_stochastic_highest_lowest():
    high = np.array([2.0, 4, 4])
    low = np.array([0.0, 1, 2])
    close = np.array([1.0, 3, 3])
    stoch = stochastic(high, low, close, 2, 2)
    assert stoch["k"][1] == pytest.approx(75)
    assert stoch["k"][2] == pytest.approx(100 * 2 / 3)
    assert stoch["d"][2] == pytest.approx((75 + 100 * 2 / 3) / 2)
    assert highest(np.array([1.0, 3, 2]), 2)[1:].tolist() == pytest.approx([3, 3])
    assert lowest(np.array([4.0, 1, 2]), 2)[1:].tolist() == pytest.approx([1, 1])


def test_macd_and_one_sided_adx():
    close = np.arange(1.0, 40.0)
    lines = macd(close, 3, 6, 3)
    assert np.isfinite(lines["histogram"][-1])
    assert lines["histogram"][-1] == pytest.approx(lines["line"][-1] - lines["signal"][-1])
    high = np.arange(1.0, 8.0)
    low = high - 1
    trend = adx(high, low, (high + low) / 2, 2)
    # Bar 1 true range is 1.5 and +DM is 1, so +DI = 100 * 1 / 2.5. Bar 2 smooths to 1.5 / 2.75.
    assert trend["plus_di"][1] == pytest.approx(40)
    assert trend["plus_di"][2] == pytest.approx(100 * 1.5 / 2.75)
    assert trend["minus_di"][2] == pytest.approx(0)
    assert trend["adx"][2] == pytest.approx(100)


def test_period_bounds():
    with pytest.raises(ValueError):
        sma(np.array([1.0, 2]), 1)
