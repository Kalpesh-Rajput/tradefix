from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.schemas.ai_insights import (
    AiInsightsFeed,
    InsightCard,
    InsightFocus,
    InsightMetric,
    InsightNewsItem,
    InsightSummary,
    InsightTradeFilter,
    InsightWeekly,
    InsightWhy,
)
from app.services.ai.insights import copy as templates
from app.services.ai.insights.cohorts import (
    avg_r,
    group_by,
    pnl_of,
    r_multiple,
    session_of,
    setup_of,
    win_rate,
)
from app.services.ai.insights.detectors import detect_all
from app.services.ai.insights.news import detect_news
from app.services.ai.insights.rank import confidence_for, rank_candidates
from app.services.ai.insights.types import Candidate, MIN_TRADES_OVERALL

logger = logging.getLogger(__name__)


def _card(candidate: Candidate) -> InsightCard:
    conf = confidence_for(candidate.n, candidate.financial)
    category = candidate.category
    if conf == "early" and category not in {"news", "change"}:
        category = "early"
    news_items = None
    if candidate.news_items:
        news_items = [InsightNewsItem(**item) for item in candidate.news_items if item.get("url")]
    allowed = set(InsightTradeFilter.model_fields)
    return InsightCard(
        id=f"{candidate.detector}:{candidate.combo_label or candidate.n}",
        category=category,  # type: ignore[arg-type]
        confidence=conf,  # type: ignore[arg-type]
        title=candidate.title,
        explanation=candidate.explanation,
        metrics=[InsightMetric(**m) for m in candidate.metrics],
        evidence=candidate.evidence,
        why=InsightWhy(
            sample_size=candidate.n,
            matching_trades=candidate.matching_trades,
            losses=candidate.losses,
            loss_share=round(candidate.loss_share, 3) if candidate.loss_share is not None else None,
            narrative=candidate.why_narrative,
        ),
        trade_filter=InsightTradeFilter(**{k: v for k, v in candidate.trade_filter.items() if k in allowed}),
        ask_question=candidate.ask_question,
        primary_action_label=candidate.primary_action_label,
        suggested_rule=candidate.suggested_rule,
        news_items=news_items,
    )


def _focus(ranked: list[Candidate]) -> InsightFocus | None:
    negatives = [
        c
        for c in ranked
        if c.category in {"leak", "behavior", "rule", "overtrading", "early"} and c.suggested_action
    ]
    if not negatives:
        negatives = [c for c in ranked if c.category in {"leak", "behavior", "rule", "overtrading"}]
    if not negatives:
        return None
    top = negatives[0]
    action = top.suggested_action or "Review the trades behind this pattern before your next session."
    rule = top.suggested_rule or action
    allowed = set(InsightTradeFilter.model_fields)
    return InsightFocus(
        title=action,
        why=top.why_narrative,
        suggested_action=action,
        suggested_rule=rule,
        ask_question=top.ask_question,
        trade_filter=InsightTradeFilter(**{k: v for k, v in top.trade_filter.items() if k in allowed}),
    )


def _weekly(trades: list, ranked: list[Candidate], focus: InsightFocus | None) -> InsightWeekly | None:
    stamps = [t.opened_at for t in trades if getattr(t, "opened_at", None)]
    if not stamps:
        return None
    latest = max(stamps)
    if latest.tzinfo is None:
        latest = latest.replace(tzinfo=timezone.utc)
    start = latest - timedelta(days=7)
    week = [t for t in trades if t.opened_at and t.opened_at >= start]
    setups = group_by(week, setup_of)
    best_setup = None
    if setups:
        best_setup = max(setups.items(), key=lambda kv: (avg_r(kv[1]) is not None, avg_r(kv[1]) or 0, len(kv[1])))[0]
    sessions = group_by(week, session_of)
    best_session = None
    if sessions:
        best_session = max(
            sessions.items(), key=lambda kv: (avg_r(kv[1]) is not None, avg_r(kv[1]) or 0, len(kv[1]))
        )[0]
    leak = next((c.combo_label or c.title for c in ranked if c.category in {"leak", "early", "overtrading"}), None)
    r_vals = [v for v in (r_multiple(t) for t in week) if v is not None]
    adherence = None
    if week:
        clean = sum(1 for t in week if not list(getattr(t, "rules_broken", None) or []))
        adherence = round(clean / len(week) * 100, 0)
    improvement = next(
        (c.evidence for c in ranked if c.category == "change" and "decreased" in c.explanation.lower()),
        None,
    )
    return InsightWeekly(
        date_from=start.date().isoformat(),
        date_to=latest.date().isoformat(),
        trades=len(week),
        win_rate=win_rate(week) if week else None,
        pnl=round(sum(pnl_of(t) for t in week), 2),
        performance_r=round(sum(r_vals), 2) if r_vals else None,
        best_setup=best_setup,
        biggest_leak=leak,
        best_session=best_session,
        rule_adherence=adherence,
        biggest_improvement=improvement,
        main_focus=focus.suggested_action if focus else None,
    )


def _summary_parts(ranked: list[Candidate], focus: InsightFocus | None) -> list[str]:
    parts: list[str] = []
    leak = next((c for c in ranked if c.category in {"leak", "overtrading", "behavior"}), None)
    edge = next((c for c in ranked if c.category == "edge"), None)
    change = next((c for c in ranked if c.category == "change"), None)
    if leak and leak.explanation:
        rest = leak.explanation[0].lower() + leak.explanation[1:]
        parts.append(f"Your biggest issue right now is {rest}".rstrip(".") + ".")
    elif leak:
        parts.append(leak.title)
    if edge:
        parts.append(edge.explanation.rstrip(".") + ".")
    if change:
        parts.append(change.explanation.rstrip(".") + ".")
    if focus and not leak:
        parts.append(focus.suggested_action)
    return parts[:3]


def _polish_summary(text: str) -> str:
    try:
        from app.services.ai.openrouter_client import generate_text, get_provider

        if not get_provider().is_configured():
            return text
        polished = generate_text(
            "Rewrite this trading-journal briefing in 3 short sentences. Keep every number, setup, and claim. No generic advice.",
            text,
            max_tokens=220,
        )
        return polished or text
    except Exception:
        logger.debug("Insight briefing polish skipped", exc_info=True)
        return text


def build_feed(trades: list, *, include_news: bool = False, max_loss: float | None = None) -> AiInsightsFeed:
    now = datetime.now(timezone.utc)
    analysed = len(trades)
    if analysed < MIN_TRADES_OVERALL:
        return AiInsightsFeed(
            generated_at=now,
            trades_analysed=analysed,
            enough_data=False,
            summary=InsightSummary(
                text=(
                    "Keep logging your trades and I'll start identifying your strongest setups, "
                    "performance leaks, behavioral patterns and opportunities."
                ),
                ask_question="Ask about my performance",
                attention_count=0,
            ),
            insights=[],
            focus=None,
            weekly=_weekly(trades, [], None),
        )

    candidates = detect_all(trades, max_loss=max_loss)
    if include_news:
        try:
            candidates.extend(detect_news(trades))
        except Exception:
            logger.debug("News insight skipped", exc_info=True)
    ranked = rank_candidates(candidates, analysed)
    cards = [_card(c) for c in ranked]
    focus = _focus(ranked)
    weekly = _weekly(trades, ranked, focus)
    parts = _summary_parts(ranked, focus)
    briefing = templates.summary_template(parts, len(cards))
    if cards and include_news:
        briefing = _polish_summary(briefing)
    return AiInsightsFeed(
        generated_at=now,
        trades_analysed=analysed,
        enough_data=True,
        summary=InsightSummary(
            text=briefing,
            ask_question="Ask about my performance",
            attention_count=len(cards),
        ),
        insights=cards,
        focus=focus,
        weekly=weekly,
    )
