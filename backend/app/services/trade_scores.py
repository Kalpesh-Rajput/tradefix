"""Trade scoring helpers — Execution Score + Health Score."""

from __future__ import annotations

from app.models.trade import Trade


def health_score(trade: Trade) -> float | None:
    dims = [
        trade.score_preparation,
        trade.score_risk,
        trade.score_entry,
        trade.score_exit,
        trade.score_discipline,
        trade.score_psychology,
    ]
    rated = [int(d) for d in dims if d is not None]
    if not rated:
        return None
    return round(sum(rated) / len(rated) * 10, 1)  # 1-10 → 10-100 scale


def execution_score(trade: Trade, followed: str | None = None) -> int:
    """0–100 chase metric from compliance, mistakes, risk, screenshots, check-in."""
    score = 40.0

    if trade.plan_compliance is not None:
        score += (float(trade.plan_compliance) / 10.0) * 25.0
    else:
        score += 8.0

    mistakes = list(trade.rules_broken or [])
    emotion = list(trade.emotion_tags or [])
    bad = len(mistakes) + sum(1 for e in emotion if e.lower() not in ("calm/neutral", "calm", "neutral"))
    score -= min(25.0, bad * 6.0)

    if trade.risk_amount is not None and float(trade.risk_amount) > 0:
        score += 10.0
        if trade.pnl is not None:
            r = abs(float(trade.pnl) / float(trade.risk_amount))
            if r <= 3.5:
                score += 5.0

    shots = list(trade.screenshot_urls or [])
    if shots:
        score += 8.0

    if followed == "yes":
        score += 10.0
    elif followed == "partial":
        score += 4.0
    elif followed == "no":
        score -= 8.0

    hs = health_score(trade)
    if hs is not None:
        score = score * 0.7 + hs * 0.3

    return int(max(0, min(100, round(score))))


def r_multiple(trade: Trade) -> float | None:
    if trade.pnl is None or trade.risk_amount is None or float(trade.risk_amount) == 0:
        return None
    return round(float(trade.pnl) / float(trade.risk_amount), 3)
