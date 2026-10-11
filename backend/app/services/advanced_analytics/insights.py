"""Key findings generated only from validated with-vs-without comparisons.

Each candidate compares trades in one bucket (an emotion, a broken rule, an hour,
a setup, ...) with every other trade in scope using compare_groups (Welch t on
mean P&L). Only "strong" (t >= 2) or "moderate" (1 <= t < 2) comparisons with at
least MIN_GROUP trades on both sides become findings.

Ranking (documented in RANKING_METHOD): evidence tier first, then money magnitude
= |difference in average P&L| x trades in the bucket. Money magnitude measures
size, the tier measures how distinguishable the gap is from noise; neither is a
probability that the pattern continues. One finding per dimension, so mirror
statements ("after a win did better" / "after a loss did worse") are not repeated.
"""

from __future__ import annotations

from typing import Any, Callable, Sequence

from app.services.advanced_analytics.core import (
    CLEAN,
    HOLD_BUCKETS,
    NO_STRATEGY,
    WEEKDAY_NAMES,
    Context,
    TradeView,
)
from app.services.advanced_analytics.psychology import AFTER_LABELS, label_comparisons

MAX_FINDINGS = 8
PER_DIMENSION = 1
TIER = {"strong": 2, "moderate": 1}
RANKING_METHOD = (
    "Findings need at least 5 trades on each side of the comparison. They are ordered by evidence "
    "strength (gap of 2+ standard errors = strong, 1–2 = moderate), then by the money involved "
    "(difference in average P&L × number of trades)."
)

_HOLD = {key: label for key, label, _ in HOLD_BUCKETS}
_TN = {"1": "1st trade of the day", "2": "2nd trade of the day", "3": "3rd trade of the day", "4": "4th trade of the day", "5+": "5th+ trade of the day"}

DimensionSpec = tuple[str, str, Callable[[str], str], str, Sequence[str]]

SPECS: tuple[DimensionSpec, ...] = (
    ("emotion", "psychology", lambda k: f"Trades tagged “{k}”", "emotion tag", ()),
    ("mood", "psychology", lambda k: f"Trades logged with mood “{k}”", "mood", ()),
    ("rule", "discipline", lambda k: f"Trades where “{k}” was broken", "broken rule", (CLEAN,)),
    ("quick_reentry", "psychology", lambda k: "Quick re-entries after a loss", "re-entry timing", ("no",)),
    ("after", "psychology", lambda k: AFTER_LABELS.get(k, k), "previous result", ("first",)),
    ("trade_number", "discipline", lambda k: _TN.get(k, k), "trade count", ()),
    ("weekday", "timing", lambda k: f"{WEEKDAY_NAMES[int(k)]} trades", "weekday", ()),
    ("hour", "timing", lambda k: f"Trades entered {int(k):02d}:00–{int(k):02d}:59", "entry hour", ()),
    ("session", "timing", lambda k: f"{k} session trades", "session", ()),
    ("hold", "timing", lambda k: f"Trades held {_HOLD.get(k, k)}", "hold time", ()),
    ("strategy", "strategy", lambda k: f"Strategy “{k}”", "strategy", (NO_STRATEGY,)),
    ("setup", "strategy", lambda k: f"Setup “{k}”", "setup", ()),
    ("symbol", "strategy", lambda k: f"{k} trades", "symbol", ()),
    ("side", "strategy", lambda k: f"{k.title()} trades", "direction", ()),
)


def _finding(dimension: str, category: str, subject: str, noun: str, row: dict[str, Any], period: str) -> dict[str, Any]:
    diff = float(row["diff"])
    tone = "positive" if diff > 0 else "negative"
    verb = "outperformed" if diff > 0 else "underperformed"
    evidence = row["evidence"]
    qualification = None
    if evidence == "moderate":
        qualification = (
            "Moderate evidence: the gap is 1–2 standard errors, so it could still be noise. Treat it as a pattern to watch."
        )
    elif row["n_with"] < 20:
        qualification = (
            f"The gap is clear, but it rests on only {row['n_with']} trades. A few more could change it."
        )
    return {
        "id": f"{dimension}:{row['key']}",
        "category": category,
        "dimension": dimension,
        "key": row["key"],
        "tone": tone,
        "headline": f"{subject} {verb} your other trades",
        "explanation": (
            f"Compared by {noun}: average P&L per trade in this group versus all other trades in {period}. "
            "This is an association in your history, not proof of cause."
        ),
        "metric_label": "Avg P&L per trade",
        "value": row["avg_with"],
        "baseline": row["avg_without"],
        "diff": row["diff"],
        "win_rate": row["win_rate"],
        "win_rate_baseline": row["win_rate_without"],
        "sample_size": row["n_with"],
        "comparison_size": row["n_without"],
        "net_pnl": row["net_pnl"],
        "evidence": evidence,
        "t_stat": row["t_stat"],
        "magnitude": round(abs(diff) * row["n_with"], 2),
        "period": period,
        "qualification": qualification,
        "drill": {"dimension": dimension, "key": row["key"]},
    }


def build(views: Sequence[TradeView], ctx: Context, period: str) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    for dimension, category, subject_fn, noun, exclude in SPECS:
        comp = label_comparisons(dimension, views, ctx, exclude=exclude)
        rows = [r for r in comp["rows"] if r["evidence"] in TIER and r["diff"]]
        for row in rows:
            candidates.append(_finding(dimension, category, subject_fn(row["key"]), noun, row, period))
    candidates.sort(key=lambda f: (TIER[f["evidence"]], f["magnitude"]), reverse=True)
    picked: list[dict[str, Any]] = []
    per_dim: dict[str, int] = {}
    for f in candidates:
        if per_dim.get(f["dimension"], 0) >= PER_DIMENSION:
            continue
        picked.append(f)
        per_dim[f["dimension"]] = per_dim.get(f["dimension"], 0) + 1
        if len(picked) >= MAX_FINDINGS:
            break
    return {
        "items": picked,
        "candidates_evaluated": len(candidates),
        "ranking_method": RANKING_METHOD,
        "status": "ok" if picked else "insufficient",
        "reason": None
        if picked
        else "No pattern in this range has enough trades on both sides with a clear enough gap to report.",
    }
