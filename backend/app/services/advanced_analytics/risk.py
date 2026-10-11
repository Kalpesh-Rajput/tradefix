"""Risk and statistical quality.

- R-multiple: stored net P&L / risk_amount (authoritative, see trade_scores.r_multiple).
- SQN (Van Tharp): sqrt(min(nR, 100)) * mean(R) / stdev(R), sample stdev, needs >= 30 R trades.
- Kelly (educational): W - (1 - W) / b with W = wins / (wins + losses), b = avg win / |avg loss|.
  A range is derived from the Wilson 95% interval on W. "stable" only when the range is
  fully positive, narrower than 15 points, and based on 100+ decisive trades.
  Never a sizing recommendation.
- Plan vs outcome: target R = |target - entry| / |entry - stop| using the *last recorded*
  stop (the schema keeps no initial-stop history, so a moved stop changes this value).
- Streaks: consecutive wins / losses in entry order; a breakeven ends any streak
  (same rule as stats_service.overview_from_trades).
"""

from __future__ import annotations

import math
from collections import Counter
from typing import Any, Sequence

from app.services.advanced_analytics.core import (
    R_LABELS,
    TradeView,
    entry_order,
    mean,
    r_bucket,
    sample_stdev,
    stats,
)

MIN_R_TRADES = 10
MIN_SQN_TRADES = 30
MIN_KELLY_TRADES = 30
MIN_PLAN_TRADES = 10
KELLY_STABLE_WIDTH_PCT = 15.0

KELLY_NOTE = "Historical estimate for education only. It is not a position-size recommendation."

SQN_BANDS = (
    (1.6, "Below average"),
    (2.0, "Average"),
    (2.5, "Good"),
    (3.0, "Excellent"),
    (5.0, "Superb"),
    (math.inf, "Holy grail"),
)


def _insufficient(reason: str, n: int) -> dict[str, Any]:
    return {"status": "insufficient", "reason": reason, "sample_size": n}


def r_stats(views: Sequence[TradeView]) -> dict[str, Any]:
    r_values = [v.r for v in views if v.r is not None]
    coverage = round(len(r_values) / len(views) * 100, 1) if views else 0.0
    counts = Counter(r_bucket(r) for r in r_values)
    distribution = [{"bucket": label, "count": counts.get(label, 0)} for label in R_LABELS]
    if len(r_values) < MIN_R_TRADES:
        return {
            **_insufficient(
                f"Needs at least {MIN_R_TRADES} trades with a risk amount; this range has {len(r_values)}.",
                len(r_values),
            ),
            "coverage_pct": coverage,
            "distribution": distribution,
        }
    ordered = sorted(r_values)
    mid = len(ordered) // 2
    median = ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2
    return {
        "status": "ok",
        "reason": None,
        "sample_size": len(r_values),
        "coverage_pct": coverage,
        "mean": round(mean(r_values) or 0.0, 3),
        "median": round(median, 3),
        "stdev": round(sample_stdev(r_values) or 0.0, 3),
        "best": round(ordered[-1], 3),
        "worst": round(ordered[0], 3),
        "share_ge_1r": round(sum(1 for r in r_values if r >= 1) / len(r_values) * 100, 1),
        "share_le_minus_1r": round(sum(1 for r in r_values if r <= -1) / len(r_values) * 100, 1),
        "distribution": distribution,
    }


def sqn(views: Sequence[TradeView]) -> dict[str, Any]:
    r_values = [v.r for v in views if v.r is not None]
    n = len(r_values)
    if n < MIN_SQN_TRADES:
        return _insufficient(f"SQN needs at least {MIN_SQN_TRADES} trades with a risk amount; this range has {n}.", n)
    sd = sample_stdev(r_values) or 0.0
    if sd <= 0:
        return _insufficient("Every R-multiple is identical, so SQN is undefined.", n)
    value = math.sqrt(min(n, 100)) * (mean(r_values) or 0.0) / sd
    band = next(label for limit, label in SQN_BANDS if value < limit)
    return {
        "status": "ok",
        "reason": None,
        "sample_size": n,
        "value": round(value, 2),
        "band": band if value >= 0 else "Negative",
        "formula": "√min(N, 100) × mean(R) ÷ stdev(R)",
    }


def _wilson(p: float, n: int, z: float = 1.96) -> tuple[float, float]:
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return max(0.0, centre - half), min(1.0, centre + half)


def kelly(views: Sequence[TradeView]) -> dict[str, Any]:
    s = stats(views)
    decisive = s["wins"] + s["losses"]
    if decisive < MIN_KELLY_TRADES:
        return {
            **_insufficient(f"Needs at least {MIN_KELLY_TRADES} winning or losing trades; this range has {decisive}.", decisive),
            "note": KELLY_NOTE,
        }
    if not s["losses"] or not s["wins"] or not s["payoff"]:
        return {**_insufficient("Needs both winning and losing trades to estimate.", decisive), "note": KELLY_NOTE}
    b = float(s["payoff"])
    w = s["wins"] / decisive
    lo_w, hi_w = _wilson(w, decisive)

    def k(p: float) -> float:
        return p - (1 - p) / b

    value, lo, hi = k(w), k(lo_w), k(hi_w)
    stable = lo > 0 and decisive >= 100 and (hi - lo) * 100 <= KELLY_STABLE_WIDTH_PCT
    return {
        "status": "ok",
        "reason": None,
        "sample_size": decisive,
        "value_pct": round(value * 100, 1),
        "range_low_pct": round(lo * 100, 1),
        "range_high_pct": round(hi * 100, 1),
        "win_probability": round(w * 100, 1),
        "payoff": round(b, 2),
        "positive_edge": value > 0,
        "stability": "stable" if stable else "unstable",
        "note": KELLY_NOTE,
    }


def _target_r(v: TradeView) -> float | None:
    entry, stop, target = v.entry_price, v.stop_loss, v.profit_target
    if entry is None or stop is None or target is None or v.risk_amount in (None, 0.0) or v.r is None:
        return None
    if v.side == "short":
        valid = stop > entry > target
    else:
        valid = stop < entry < target
    if not valid:
        return None
    risk_dist = abs(entry - stop)
    if risk_dist <= 0:
        return None
    return abs(target - entry) / risk_dist


def plan_vs_outcome(views: Sequence[TradeView]) -> dict[str, Any]:
    rows = []
    for v in views:
        planned = _target_r(v)
        if planned is not None:
            rows.append((planned, float(v.r)))
    n = len(rows)
    note = "Uses the last recorded stop-loss. If a stop was moved during the trade, its planned R:R changes too."
    if n < MIN_PLAN_TRADES:
        return {
            **_insufficient(
                f"Needs at least {MIN_PLAN_TRADES} trades with entry, stop, target and risk recorded; this range has {n}.",
                n,
            ),
            "note": note,
        }
    planned = [p for p, _ in rows]
    realized = [r for _, r in rows]
    reached = sum(1 for p, r in rows if r >= p)
    stopped = sum(1 for _, r in rows if r <= -1)
    captures = [r / p for p, r in rows if p > 0]
    return {
        "status": "ok",
        "reason": None,
        "sample_size": n,
        "avg_planned_r": round(mean(planned) or 0.0, 2),
        "avg_realized_r": round(mean(realized) or 0.0, 2),
        "target_reached_pct": round(reached / n * 100, 1),
        "full_stop_pct": round(stopped / n * 100, 1),
        "avg_capture_pct": round((mean(captures) or 0.0) * 100, 1),
        "note": note,
    }


def streaks(views: Sequence[TradeView]) -> dict[str, Any]:
    runs: list[tuple[str, int]] = []
    for v in entry_order(views):
        outcome = v.outcome
        if outcome == "breakeven":
            runs.append(("breakeven", 1))
            continue
        if runs and runs[-1][0] == outcome:
            runs[-1] = (outcome, runs[-1][1] + 1)
        else:
            runs.append((outcome, 1))
    win_runs = [n for kind, n in runs if kind == "win"]
    loss_runs = [n for kind, n in runs if kind == "loss"]
    longest = max(win_runs + loss_runs, default=0)
    distribution = []
    for length in range(1, max(longest, 1) + 1):
        distribution.append(
            {
                "length": length,
                "win_streaks": sum(1 for n in win_runs if n == length),
                "loss_streaks": sum(1 for n in loss_runs if n == length),
            }
        )
    current_kind, current_len = ("none", 0)
    if runs and runs[-1][0] != "breakeven":
        current_kind, current_len = runs[-1]
    return {
        "max_win_streak": max(win_runs, default=0),
        "max_loss_streak": max(loss_runs, default=0),
        "avg_win_streak": round(mean(win_runs) or 0.0, 2) if win_runs else None,
        "avg_loss_streak": round(mean(loss_runs) or 0.0, 2) if loss_runs else None,
        "current_type": current_kind,
        "current_length": current_len,
        "distribution": distribution[:20],
    }
