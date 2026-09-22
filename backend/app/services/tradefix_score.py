"""TradeFix Score — composite performance profile from closed-trade P&L.

P&L input is the stored realized `trade.pnl` value. That field is net of
commission/fees (and broker swap folded into fees on import). This module
never subtracts fees again.

Open/cancelled trades are not passed in; callers must supply closed trades
with non-null pnl (see stats_service.full_analytics).

Each raw metric is normalized to 0–100 with a capped piecewise scale, then
combined with fixed weights. Raw units are never averaged together.

Weights (must sum to 1):
  Win rate            15%
  Profit factor       25%
  Average win/loss    15%
  Recovery factor     15%
  Drawdown            20%
  Consistency         10%
"""

from __future__ import annotations

import math
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Sequence

WEIGHTS = {
    "win_rate": 0.15,
    "profit_factor": 0.25,
    "average_win_loss": 0.15,
    "recovery_factor": 0.15,
    "drawdown": 0.20,
    "consistency": 0.10,
}

# Piecewise (x, score) control points. Linear between points, clamped outside.
WIN_RATE_CURVE = ((0, 0), (30, 25), (40, 40), (50, 55), (60, 75), (70, 90), (90, 100))
RATIO_CURVE = ((0, 0), (0.8, 28), (1.0, 50), (1.5, 70), (2.0, 85), (3.0, 100))
RECOVERY_CURVE = ((0, 18), (1.0, 50), (2.0, 70), (4.0, 90), (6.0, 100))
# Inverse: smaller drawdown % → higher score. Not `100 - dd%`.
DRAWDOWN_CURVE = ((0, 100), (5, 88), (10, 74), (15, 58), (25, 35), (40, 12), (60, 0))
POSITIVE_DAY_CURVE = ((0, 0), (30, 25), (50, 55), (65, 78), (80, 94), (100, 100))
CV_CURVE = ((0, 100), (0.4, 82), (0.8, 62), (1.2, 42), (2.0, 18), (3.0, 0))
CONCENTRATION_CURVE = ((0.25, 100), (0.45, 82), (0.65, 55), (0.85, 22), (1.0, 0))

CONFIDENCE_EARLY = 5
CONFIDENCE_DEVELOPING = 20
CONFIDENCE_ESTABLISHED = 50


def _has_pnl(trade: Any) -> bool:
    return getattr(trade, "pnl", None) is not None


def _pnl(trade: Any) -> float:
    return float(getattr(trade, "pnl", 0) or 0)


def _when(trade: Any) -> datetime:
    ts = getattr(trade, "closed_at", None) or getattr(trade, "opened_at", None)
    if ts is None:
        return datetime(1970, 1, 1, tzinfo=timezone.utc)
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts


def piecewise(x: float, curve: Sequence[tuple[float, float]]) -> float:
    """Linear interpolate along sorted (x, y) points; clamp to end scores."""
    if not math.isfinite(x):
        return 0.0
    if x <= curve[0][0]:
        return float(curve[0][1])
    for (x0, y0), (x1, y1) in zip(curve, curve[1:]):
        if x <= x1:
            if x1 == x0:
                return float(y1)
            t = (x - x0) / (x1 - x0)
            return float(y0 + t * (y1 - y0))
    return float(curve[-1][1])


def clamp_score(value: float) -> float:
    if not math.isfinite(value):
        return 0.0
    return max(0.0, min(100.0, value))


def sample_confidence(n: int) -> dict[str, Any]:
    if n <= 0:
        return {
            "level": "none",
            "label": "Not enough data",
            "sample_size": 0,
        }
    if n < CONFIDENCE_EARLY:
        return {"level": "insufficient", "label": "Not enough data", "sample_size": n}
    if n < CONFIDENCE_DEVELOPING:
        return {"level": "low", "label": "Early data", "sample_size": n}
    if n < CONFIDENCE_ESTABLISHED:
        return {"level": "moderate", "label": "Developing", "sample_size": n}
    return {"level": "high", "label": "Established", "sample_size": n}


def realized_totals(trades: Iterable[Any]) -> dict[str, float | int]:
    pnls = [_pnl(t) for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    flats = [p for p in pnls if p == 0]
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    return {
        "count": len(pnls),
        "win_count": len(wins),
        "loss_count": len(losses),
        "breakeven_count": len(flats),
        "gross_profit": gross_profit,
        "gross_loss": gross_loss,
        "net_pnl": sum(pnls),
        "avg_win": (gross_profit / len(wins)) if wins else 0.0,
        "avg_loss": (gross_loss / len(losses)) if losses else 0.0,
    }


def win_rate_pct(totals: dict[str, float | int]) -> float | None:
    n = int(totals["count"])
    if n <= 0:
        return None
    return (int(totals["win_count"]) / n) * 100.0


def profit_factor_ratio(totals: dict[str, float | int]) -> float | None:
    """Gross profit / abs(gross loss). None when undefined (no losses)."""
    loss = float(totals["gross_loss"])
    profit = float(totals["gross_profit"])
    if loss > 0:
        return profit / loss
    if profit > 0:
        return None
    return 0.0


def average_win_loss_ratio(totals: dict[str, float | int]) -> float | None:
    """Average win / average loss. None when there are no losing trades."""
    avg_loss = float(totals["avg_loss"])
    avg_win = float(totals["avg_win"])
    if avg_loss > 0:
        return avg_win / avg_loss
    if avg_win > 0:
        return None
    return 0.0


def equity_path(trades: Sequence[Any], starting_equity: float = 0.0) -> list[float]:
    """Chronological realized equity after each closed trade (by exit time)."""
    ordered = sorted(trades, key=_when)
    running = float(starting_equity)
    path = [running]
    for t in ordered:
        running += _pnl(t)
        path.append(running)
    return path


def max_drawdown(trades: Sequence[Any], starting_equity: float = 0.0) -> dict[str, float]:
    """Peak-to-trough decline on the realized equity curve — not worst single trade."""
    path = equity_path(trades, starting_equity)
    if len(path) <= 1:
        return {"amount": 0.0, "pct": 0.0, "peak": float(starting_equity)}
    peak = path[0]
    max_dd = 0.0
    for equity in path:
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
    base = peak if peak > 0 else (abs(starting_equity) if starting_equity else 1.0)
    return {
        "amount": max_dd,
        "pct": (max_dd / base) * 100.0 if base else 0.0,
        "peak": peak,
    }


def recovery_factor_value(net_pnl: float, drawdown_amount: float) -> float | None:
    """Net profit / abs(max drawdown). None when drawdown is 0 (undefined)."""
    if drawdown_amount > 0:
        return net_pnl / drawdown_amount
    if net_pnl > 0:
        return None
    return 0.0


def daily_pnl(trades: Sequence[Any]) -> dict[Any, float]:
    out: dict[Any, float] = {}
    for t in trades:
        day = _when(t).date()
        out[day] = out.get(day, 0.0) + _pnl(t)
    return out


def consistency_breakdown(trades: Sequence[Any], totals: dict[str, float | int]) -> dict[str, Any]:
    """Period stability: green-day share, daily variability, profit concentration.

    This is not win rate. It asks whether results repeat across days and whether
    a handful of winners dominate the book.
    """
    days = list(daily_pnl(trades).values())
    trading_days = len(days)
    profitable_days = sum(1 for v in days if v > 0)
    losing_days = sum(1 for v in days if v < 0)
    flat_days = trading_days - profitable_days - losing_days
    positive_pct = (profitable_days / trading_days * 100.0) if trading_days else None

    if trading_days >= 2:
        mean_abs = sum(abs(v) for v in days) / trading_days
        stdev = statistics.pstdev(days)
        cv = (stdev / mean_abs) if mean_abs > 1e-9 else 0.0
    else:
        cv = None

    pnls = sorted((_pnl(t) for t in trades if _pnl(t) > 0), reverse=True)
    gross_profit = float(totals["gross_profit"])
    top_n = min(3, len(pnls))
    top_sum = sum(pnls[:top_n]) if top_n else 0.0
    concentration = (top_sum / gross_profit) if gross_profit > 0 else 0.0

    pos_score = piecewise(positive_pct or 0.0, POSITIVE_DAY_CURVE) if positive_pct is not None else 50.0
    stab_score = piecewise(cv, CV_CURVE) if cv is not None else 50.0
    div_score = piecewise(concentration, CONCENTRATION_CURVE)
    score = clamp_score(0.40 * pos_score + 0.30 * stab_score + 0.30 * div_score)

    return {
        "score": score,
        "trading_days": trading_days,
        "profitable_days": profitable_days,
        "losing_days": losing_days,
        "flat_days": flat_days,
        "positive_day_pct": positive_pct,
        "daily_cv": cv,
        "profit_concentration": concentration,
        "top_win_count": top_n,
        "top_win_pnl": top_sum,
    }


def _metric(
    key: str,
    *,
    actual: float | None,
    score: float,
    display: str,
    unit: str,
    formula: str,
    definition: str,
    inputs: dict[str, Any],
    undefined_reason: str | None = None,
) -> dict[str, Any]:
    weight = WEIGHTS[key]
    bounded = clamp_score(score)
    return {
        "key": key,
        "actual": actual,
        "display": display,
        "unit": unit,
        "score": bounded,
        "weight": weight,
        "contribution": bounded * weight,
        "formula": formula,
        "definition": definition,
        "inputs": inputs,
        "undefined_reason": undefined_reason,
    }


def _fmt_ratio(value: float | None) -> str:
    if value is None:
        return "—"
    if abs(value) >= 10:
        return f"{value:.1f}"
    return f"{value:.2f}"


def _fmt_pct(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:.1f}%"


def score_win_rate(actual: float | None) -> float:
    # 70% maps to 90, not 100 — high win rate alone is not a perfect book.
    if actual is None:
        return 0.0
    return clamp_score(piecewise(actual, WIN_RATE_CURVE))


def score_ratio(actual: float | None, *, all_wins: bool) -> float:
    if actual is None and all_wins:
        # Ratio undefined with no losses. Strong gross book, but loss size is untested.
        return 92.0
    if actual is None:
        return 0.0
    return clamp_score(piecewise(actual, RATIO_CURVE))


def score_recovery(actual: float | None, *, net_pnl: float, has_drawdown: bool) -> float:
    if actual is None and not has_drawdown:
        if net_pnl > 0:
            return 92.0
        return 45.0
    if actual is None:
        return 0.0
    if actual < 0:
        # Lost more than the worst decline recovered — keep the floor low.
        return clamp_score(18.0 + actual * 8.0)
    return clamp_score(piecewise(actual, RECOVERY_CURVE))


def score_drawdown(dd_pct: float) -> float:
    return clamp_score(piecewise(max(0.0, dd_pct), DRAWDOWN_CURVE))


METRIC_TITLES = {
    "win_rate": "Win Rate",
    "profit_factor": "Profit Factor",
    "average_win_loss": "Average Win/Loss",
    "recovery_factor": "Recovery Factor",
    "drawdown": "Drawdown",
    "consistency": "Consistency",
}


def _insights(metrics: dict[str, dict[str, Any]], totals: dict[str, float | int], consistency: dict[str, Any]) -> list[dict[str, str]]:
    ranked = sorted(metrics.values(), key=lambda m: m["score"], reverse=True)
    strongest = ranked[0]
    weakest = ranked[-1]
    wr = metrics["win_rate"]["actual"]
    awl = metrics["average_win_loss"]["actual"]
    conc = consistency.get("profit_concentration") or 0.0
    items: list[dict[str, str]] = []
    items.append(
        {
            "kind": "strongest",
            "text": f"Your strongest dimension is {METRIC_TITLES[strongest['key']]} at {strongest['score']:.0f}/100.",
        }
    )
    items.append(
        {
            "kind": "attention",
            "text": f"{METRIC_TITLES[weakest['key']]} is currently reducing your overall score.",
        }
    )
    if wr is not None:
        items.append({"kind": "fact", "text": f"{wr:.0f}% of closed trades are profitable."})
    if awl is not None and awl > 0:
        items.append({"kind": "fact", "text": f"Your average win is {awl:.1f}× your average loss."})
    if conc >= 0.7 and float(totals["gross_profit"]) > 0:
        items.append(
            {
                "kind": "concentration",
                "text": "Your results are highly concentrated in a small number of winning trades.",
            }
        )
    improve = {
        "win_rate": "A higher share of winning closed trades would lift this dimension — review setups that lose often.",
        "profit_factor": "Gross losses are large relative to gross profits. Tighten losers or let winners run with a defined exit.",
        "average_win_loss": "Average losses are large versus average wins. Review stop placement and hold time on losers.",
        "recovery_factor": "Net profit is small relative to the worst equity decline. Reducing that decline would raise this score.",
        "drawdown": "Reducing peak-to-trough equity declines would improve this dimension.",
        "consistency": "Daily results vary significantly. Review position sizing and losing-day patterns.",
    }
    items.append({"kind": "improve", "text": improve[weakest["key"]]})
    return items


def empty_score() -> dict[str, Any]:
    return {
        "overall_score": None,
        "confidence": sample_confidence(0),
        "sample_size": 0,
        "closed_trades": 0,
        "starting_equity": None,
        "previous_score": None,
        "previous_delta": None,
        "metrics": {},
        "insights": [],
        "pnl_basis": "net",
        "pnl_note": "Stored trade P&L is realized net of fees. Fees are not subtracted again.",
    }


def calculate_tradefix_score(
    trades: Sequence[Any],
    *,
    starting_equity: float = 0.0,
    previous_score: float | None = None,
) -> dict[str, Any]:
    closed = [t for t in trades if _has_pnl(t)]
    if not closed:
        return empty_score()

    totals = realized_totals(closed)
    wr = win_rate_pct(totals)
    pf = profit_factor_ratio(totals)
    awl = average_win_loss_ratio(totals)
    dd = max_drawdown(closed, starting_equity=starting_equity)
    rf = recovery_factor_value(float(totals["net_pnl"]), float(dd["amount"]))
    cons = consistency_breakdown(closed, totals)
    all_wins = int(totals["loss_count"]) == 0 and int(totals["win_count"]) > 0
    has_dd = float(dd["amount"]) > 0

    wr_score = score_win_rate(wr)
    pf_score = score_ratio(pf, all_wins=all_wins)
    awl_score = score_ratio(awl, all_wins=all_wins)
    rf_score = score_recovery(rf, net_pnl=float(totals["net_pnl"]), has_drawdown=has_dd)
    dd_score = score_drawdown(float(dd["pct"]))
    cons_score = clamp_score(float(cons["score"]))

    metrics = {
        "win_rate": _metric(
            "win_rate",
            actual=wr,
            score=wr_score,
            display=_fmt_pct(wr),
            unit="%",
            formula="Winning closed trades ÷ closed trades × 100",
            definition="Share of closed trades with positive realized P&L. Break-evens count as non-wins.",
            inputs={
                "win_count": totals["win_count"],
                "loss_count": totals["loss_count"],
                "breakeven_count": totals["breakeven_count"],
                "closed_trades": totals["count"],
            },
        ),
        "profit_factor": _metric(
            "profit_factor",
            actual=pf,
            score=pf_score,
            display=_fmt_ratio(pf) if pf is not None else ("Unlimited" if all_wins else "—"),
            unit="x",
            formula="Gross profit ÷ absolute gross loss",
            definition="Gross profitability relative to gross losses. Not net P&L ÷ losses.",
            inputs={
                "gross_profit": round(float(totals["gross_profit"]), 2),
                "gross_loss": round(float(totals["gross_loss"]), 2),
            },
            undefined_reason="No losing trades — ratio is undefined and the score is capped." if pf is None and all_wins else None,
        ),
        "average_win_loss": _metric(
            "average_win_loss",
            actual=awl,
            score=awl_score,
            display=_fmt_ratio(awl) if awl is not None else ("Unlimited" if all_wins else "—"),
            unit="x",
            formula="Average win ÷ average loss",
            definition="Mean winning P&L divided by the absolute mean losing P&L.",
            inputs={
                "avg_win": round(float(totals["avg_win"]), 2),
                "avg_loss": round(float(totals["avg_loss"]), 2),
                "win_count": totals["win_count"],
                "loss_count": totals["loss_count"],
            },
            undefined_reason="No losing trades — ratio is undefined and the score is capped." if awl is None and all_wins else None,
        ),
        "recovery_factor": _metric(
            "recovery_factor",
            actual=rf,
            score=rf_score,
            display=_fmt_ratio(rf) if rf is not None else ("n/a" if not has_dd else "—"),
            unit="x",
            formula="Net profit ÷ absolute maximum drawdown",
            definition="How much net profit was produced relative to the worst peak-to-trough equity decline.",
            inputs={
                "net_pnl": round(float(totals["net_pnl"]), 2),
                "max_drawdown": round(float(dd["amount"]), 2),
            },
            undefined_reason="No drawdown on the realized equity curve — ratio is undefined." if rf is None and not has_dd else None,
        ),
        "drawdown": _metric(
            "drawdown",
            actual=float(dd["pct"]),
            score=dd_score,
            display=_fmt_pct(float(dd["pct"])),
            unit="%",
            formula="Max(peak equity − equity) ÷ peak equity × 100",
            definition="Maximum peak-to-trough decline on the chronological realized equity curve.",
            inputs={
                "max_drawdown": round(float(dd["amount"]), 2),
                "max_drawdown_pct": round(float(dd["pct"]), 2),
                "peak_equity": round(float(dd["peak"]), 2),
                "starting_equity": round(float(starting_equity), 2),
            },
        ),
        "consistency": _metric(
            "consistency",
            actual=cons.get("positive_day_pct"),
            score=cons_score,
            display=_fmt_pct(cons.get("positive_day_pct")),
            unit="%",
            formula="0.4× green-day score + 0.3× daily-stability score + 0.3× (inverse profit concentration)",
            definition="How consistently results repeat across trading days, including how much profit depends on a few trades.",
            inputs={
                "trading_days": cons["trading_days"],
                "profitable_days": cons["profitable_days"],
                "losing_days": cons["losing_days"],
                "flat_days": cons["flat_days"],
                "positive_day_pct": cons["positive_day_pct"],
                "daily_cv": cons["daily_cv"],
                "profit_concentration": cons["profit_concentration"],
            },
        ),
    }

    raw_overall = sum(m["contribution"] for m in metrics.values())
    overall = round(clamp_score(raw_overall), 1)
    n = int(totals["count"])
    confidence = sample_confidence(n)
    delta = None
    if previous_score is not None and math.isfinite(previous_score):
        delta = round(overall - previous_score, 1)

    return {
        "overall_score": overall,
        "overall_score_raw": raw_overall,
        "confidence": confidence,
        "sample_size": n,
        "closed_trades": n,
        "starting_equity": round(float(starting_equity), 2),
        "previous_score": previous_score,
        "previous_delta": delta,
        "metrics": metrics,
        "insights": _insights(metrics, totals, cons),
        "pnl_basis": "net",
        "pnl_note": "Stored trade P&L is realized net of fees. Fees are not subtracted again.",
    }


def previous_window(
    date_from: datetime | None,
    date_to: datetime | None,
) -> tuple[datetime, datetime] | None:
    if date_from is None or date_to is None:
        return None
    start = date_from
    end = date_to
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    span = end - start
    if span.total_seconds() <= 0:
        return None
    prev_end = start - timedelta(microseconds=1)
    prev_start = prev_end - span
    return prev_start, prev_end
