"""Deterministic, non-AI insight rules. These run fast and don't need an LLM
or API key at all -- they are the baseline of the /today feed.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.insight import Insight, InsightSeverity, InsightType
from app.models.trade import Trade, TradeStatus
from app.services import stats_service


def _get_closed_trades(db: Session, user_id: uuid.UUID) -> list[Trade]:
    stmt = select(Trade).where(Trade.user_id == user_id, Trade.status == TradeStatus.closed, Trade.pnl.is_not(None))
    return list(db.scalars(stmt.order_by(Trade.opened_at.asc())).all())


def _save_insight(db: Session, user_id: uuid.UUID, itype: InsightType, title: str, body: str, severity: InsightSeverity, data: dict) -> Insight:
    insight = Insight(
        user_id=user_id,
        agent_name=None,
        type=itype,
        title=title,
        body=body,
        severity=severity,
        data=data,
    )
    db.add(insight)
    db.commit()
    db.refresh(insight)
    return insight


def generate_time_edge_insight(db: Session, user_id: uuid.UUID) -> Insight | None:
    trades = _get_closed_trades(db, user_id)
    if len(trades) < 10:
        return None

    by_hour = stats_service.by_hour_stats(trades)
    eligible = [b for b in by_hour if b["trades"] >= 3]
    if len(eligible) < 2:
        return None

    best = max(eligible, key=lambda b: b["win_rate"])
    worst = min(eligible, key=lambda b: b["win_rate"])
    if best["win_rate"] - worst["win_rate"] < 25:
        return None

    body = (
        f"Your win rate is {best['win_rate']}% around {best['bucket']}, but drops to "
        f"{worst['win_rate']}% around {worst['bucket']}. Consider concentrating size in your strongest window."
    )
    return _save_insight(
        db, user_id, InsightType.time_edge, "Time edge detected", body,
        InsightSeverity.info, {"best": best, "worst": worst},
    )


def generate_streak_alert_insight(db: Session, user_id: uuid.UUID) -> Insight | None:
    streak_info = stats_service.recent_streak_info(db, user_id)
    consecutive_losses = streak_info["consecutive_losses"]
    if consecutive_losses < 3:
        return None

    body = (
        f"You're on a {consecutive_losses}-trade losing streak. Historically, performance after "
        f"a streak like this tends to be worse than your average. Consider stepping back or cutting size."
    )
    return _save_insight(
        db, user_id, InsightType.streak_alert, "Losing streak alert", body,
        InsightSeverity.warning, {"consecutive_losses": consecutive_losses},
    )


def generate_setup_insights(db: Session, user_id: uuid.UUID) -> list[Insight]:
    trades = _get_closed_trades(db, user_id)
    setups = stats_service.by_setup_stats(trades)
    created: list[Insight] = []

    for s in setups:
        if s["trades"] < 5:
            continue

        if s["win_rate_last_30d"] - s["win_rate_prior_30d"] >= 20 and s["win_rate_last_30d"] >= 60:
            body = (
                f"Your \"{s['setup_tag']}\" setup is working: {s['win_rate_last_30d']}% win rate over the "
                f"last 30 days (was {s['win_rate_prior_30d']}% the 30 days before). Net P&L ${s['pnl']}."
            )
            created.append(_save_insight(
                db, user_id, InsightType.setup_win, f"{s['setup_tag']} is hot", body,
                InsightSeverity.positive, s,
            ))
        elif s["win_rate_prior_30d"] - s["win_rate_last_30d"] >= 20 and s["win_rate_prior_30d"] >= 50:
            body = (
                f"Your \"{s['setup_tag']}\" setup's win rate dropped from {s['win_rate_prior_30d']}% to "
                f"{s['win_rate_last_30d']}% over the last 30 days. This may be a decaying edge, not just variance."
            )
            created.append(_save_insight(
                db, user_id, InsightType.setup_decay, f"{s['setup_tag']} may be decaying", body,
                InsightSeverity.warning, s,
            ))

    return created


def run_all_rules(db: Session, user_id: uuid.UUID) -> list[Insight]:
    results: list[Insight] = []
    for fn in (generate_time_edge_insight, generate_streak_alert_insight):
        insight = fn(db, user_id)
        if insight:
            results.append(insight)
    results.extend(generate_setup_insights(db, user_id))
    return results
