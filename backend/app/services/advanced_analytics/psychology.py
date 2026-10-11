"""Psychology: emotions, moods, post-outcome behaviour, and trade count per day.

Every label row compares trades *with* the label against trades *without* it in
the same scope. Labels overlap (one trade can carry several), so per-label totals
cannot be added together. Results describe associations in recorded history; they
do not establish cause, and losses on a label are not "avoidable" by definition.

Post-outcome rule: a trade's previous trade is the most recent trade whose exit
time is at or before this trade's entry time, i.e. the outcome the trader already
knew. A quick re-entry is a trade opened within 15 minutes of a losing exit.
"""

from __future__ import annotations

from typing import Any, Callable, Sequence

from app.services.advanced_analytics.core import (
    QUICK_REENTRY_MINUTES,
    TRADE_NUMBER_KEYS,
    Context,
    TradeView,
    compare_groups,
    group_by,
    keys_for,
    stats,
)

MAX_LABELS = 30
ASSOCIATION_NOTE = (
    "Shows how trades with each label performed compared with trades without it. "
    "It is a pattern in your history, not proof that the label caused the result."
)
OVERLAP_NOTE = "One trade can carry several labels, so totals overlap and cannot be added together."


def label_comparisons(
    dimension: str,
    views: Sequence[TradeView],
    ctx: Context,
    *,
    label_fn: Callable[[str], str] = lambda k: k,
    exclude: Sequence[str] = (),
) -> dict[str, Any]:
    groups = group_by(dimension, views, ctx)
    rows = []
    for key, group in groups.items():
        if key in exclude:
            continue
        ids = {v.id for v in group}
        without = [v for v in views if v.id not in ids]
        s = stats(group)
        rows.append(
            {
                "key": key,
                "label": label_fn(key),
                "trades": s["trades"],
                "win_rate": s["win_rate"],
                "net_pnl": s["net_pnl"],
                "avg_pnl": s["avg_pnl"],
                "win_rate_without": round(sum(1 for v in without if v.pnl > 0) / len(without) * 100, 1) if without else None,
                **compare_groups([v.pnl for v in group], [v.pnl for v in without]),
            }
        )
    rows.sort(key=lambda r: (r["trades"], abs(r["diff"] or 0)), reverse=True)
    labelled = [v for v in views if any(k not in exclude for k in keys_for(dimension, v, ctx))]
    multi = sum(1 for v in labelled if len([k for k in keys_for(dimension, v, ctx) if k not in exclude]) > 1)
    return {
        "rows": rows[:MAX_LABELS],
        "labelled_trades": len(labelled),
        "unlabelled_trades": len(views) - len(labelled),
        "multi_label_trades": multi,
        "overlap_pct": round(multi / len(labelled) * 100, 1) if labelled else 0.0,
        "note": ASSOCIATION_NOTE,
        "overlap_note": OVERLAP_NOTE,
    }


AFTER_LABELS = {
    "first": "First trade (no prior result)",
    "after_win": "After a win",
    "after_loss": "After a loss",
    "after_breakeven": "After a breakeven",
}


def build(views: Sequence[TradeView], ctx: Context) -> dict[str, Any]:
    after_groups = group_by("after", views, ctx)
    after = []
    for key in ("after_win", "after_loss", "after_breakeven", "first"):
        group = after_groups.get(key, [])
        if group:
            after.append({"key": key, "label": AFTER_LABELS[key], **stats(group)})

    quick = [v for v in views if v.id in ctx.quick_reentry]
    after_loss = after_groups.get("after_loss", [])
    quick_ids = {v.id for v in quick}
    patient = [v for v in after_loss if v.id not in quick_ids]
    quick_block = {
        "window_minutes": QUICK_REENTRY_MINUTES,
        "quick": stats(quick),
        "patient": stats(patient),
        "comparison": compare_groups([v.pnl for v in quick], [v.pnl for v in patient]),
        "rule": (
            f"A quick re-entry is a trade opened within {QUICK_REENTRY_MINUTES} minutes of closing a losing trade. "
            "It is compared with other trades taken after a loss."
        ),
    }

    tn_groups = group_by("trade_number", views, ctx)
    trade_number = []
    for key in TRADE_NUMBER_KEYS:
        group = tn_groups.get(key, [])
        label = "5th or later" if key == "5+" else {"1": "1st", "2": "2nd", "3": "3rd", "4": "4th"}[key]
        trade_number.append({"key": key, "label": f"{label} trade of the day", **stats(group)})

    mood_scores = group_by("mood_score", views, ctx)
    scores = [
        {"key": key, "label": f"Mood {key}/5", **stats(mood_scores[key])}
        for key in sorted(mood_scores, key=lambda k: int(k))
    ]

    return {
        "emotions": label_comparisons("emotion", views, ctx),
        "moods": label_comparisons("mood", views, ctx),
        "mood_scores": scores,
        "after_outcome": after,
        "after_rule": (
            "Each trade is matched to the most recent trade that had already closed when it was opened."
        ),
        "quick_reentry": quick_block,
        "trade_number": trade_number,
    }
