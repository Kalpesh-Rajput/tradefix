from __future__ import annotations

import logging
from datetime import datetime, timedelta

from app.services.ai.insights import copy as templates
from app.services.ai.insights.cohorts import opened_at, pnl_of, recency_share, symbol_of, trade_id, win_rate
from app.services.ai.insights.types import Candidate, MIN_EARLY

logger = logging.getLogger(__name__)


def _as_date(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10]).date()
    except ValueError:
        return None


def detect_news(trades: list, fetch_news=None) -> list[Candidate]:
    if fetch_news is None:
        try:
            from app.services.ai.tools.web import fetch_news_items

            fetch_news = fetch_news_items
        except Exception:
            return []

    counts: dict[str, list] = {}
    for trade in trades:
        symbol = symbol_of(trade)
        if not symbol:
            continue
        counts.setdefault(symbol, []).append(trade)
    ranked = sorted(counts.items(), key=lambda kv: len(kv[1]), reverse=True)[:2]
    for symbol, group in ranked:
        if len(group) < MIN_EARLY:
            continue
        try:
            items = fetch_news(symbol) or []
        except Exception:
            logger.debug("News fetch skipped for %s", symbol, exc_info=True)
            continue
        if not items:
            continue
        matched = []
        headlines = []
        for item in items[:5]:
            published = _as_date(item.get("published"))
            if published is None:
                continue
            window = {published, published - timedelta(days=1), published + timedelta(days=1)}
            near = [
                t
                for t in group
                if opened_at(t) and opened_at(t).date() in window
            ]
            if near:
                matched.extend(near)
                headlines.append(item)
        if len(matched) < MIN_EARLY:
            continue
        unique = []
        seen = set()
        for trade in matched:
            tid = trade_id(trade)
            if tid in seen:
                continue
            seen.add(tid)
            unique.append(trade)
        headline = headlines[0].get("title") or f"{symbol} news"
        wr = win_rate(unique)
        text = templates.news_copy(symbol, headline, len(unique), wr)
        return [
            Candidate(
                category="news",
                detector="news",
                title=text["title"],
                explanation=text["explanation"],
                evidence=text["evidence"],
                why_narrative=text["why"],
                n=len(unique),
                matching_trades=len(unique),
                losses=sum(1 for t in unique if pnl_of(t) < 0),
                loss_share=None,
                metrics=text["metrics"],
                trade_ids=[trade_id(t) for t in unique],
                trade_filter={"ids": [trade_id(t) for t in unique], "symbol": symbol},
                ask_question=text["ask"],
                primary_action_label=text["action"],
                financial=0.15,
                recency=recency_share(unique, trades),
                news_items=[
                    {
                        "title": h.get("title") or "",
                        "url": h.get("url") or "",
                        "publisher": h.get("publisher"),
                        "published": h.get("published"),
                    }
                    for h in headlines[:3]
                    if h.get("url")
                ],
            )
        ]
    return []
