"""Context builders. Agents receive these payloads and do not query tables themselves."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.daily_recap import DailyRecap
from app.models.day_note import DayNote
from app.models.day_plan import DayPlan
from app.models.playbook import Playbook
from app.models.trade import Trade
from app.services.ai.agents.logic import hold_seconds


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _trade_payload(trade: Trade, playbook_name: str | None) -> dict:
    tags = list(trade.setup_tags or [])
    if trade.setup_tag and trade.setup_tag not in tags:
        tags.append(trade.setup_tag)
    return {
        "id": str(trade.id),
        "symbol": trade.symbol,
        "side": trade.side.value if hasattr(trade.side, "value") else str(trade.side),
        "setup": trade.setup_tag,
        "playbook": playbook_name,
        "session": trade.session,
        "entry": float(trade.entry_price) if trade.entry_price is not None else None,
        "exit": float(trade.exit_price) if trade.exit_price is not None else None,
        "opened_at": _iso(trade.opened_at),
        "closed_at": _iso(trade.closed_at),
        "hold_seconds": hold_seconds(trade.opened_at, trade.closed_at),
        "pnl": float(trade.pnl) if trade.pnl is not None else None,
        "risk": float(trade.risk_amount) if trade.risk_amount is not None else None,
        "tags": tags,
        "rules_broken": list(trade.rules_broken or []),
        "notes": (trade.notes or "")[:500],
        "has_screenshots": bool(trade.screenshot_urls),
    }


def _playbook_names(db: Session, trades: list[Trade]) -> dict[uuid.UUID, str]:
    ids = {trade.playbook_id for trade in trades if trade.playbook_id}
    if not ids:
        return {}
    rows = db.scalars(select(Playbook).where(Playbook.id.in_(ids))).all()
    return {row.id: row.name for row in rows}


def load_trades(db: Session, user_id: uuid.UUID, trade_ids: list[uuid.UUID] | None = None, day: date | None = None, account_id: uuid.UUID | None = None, since: datetime | None = None) -> list[Trade]:
    stmt = select(Trade).where(Trade.user_id == user_id, Trade.is_deleted.is_(False))
    if trade_ids:
        stmt = stmt.where(Trade.id.in_(trade_ids))
    if account_id:
        stmt = stmt.where(Trade.account_id == account_id)
    if day is not None:
        start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        stmt = stmt.where(
            or_(
                and_(Trade.closed_at.is_not(None), Trade.closed_at >= start, Trade.closed_at < end),
                and_(Trade.closed_at.is_(None), Trade.opened_at >= start, Trade.opened_at < end),
            )
        )
    if since is not None:
        stmt = stmt.where(Trade.opened_at >= since)
    stmt = stmt.order_by(Trade.opened_at.asc()).limit(80)
    return list(db.scalars(stmt).all())


def tag_catalog(db: Session, user_id: uuid.UUID) -> list[str]:
    labels: list[str] = []

    def add(value: str | None) -> None:
        text = (value or "").strip()
        if text and text not in labels:
            labels.append(text)

    trades = db.scalars(select(Trade).where(Trade.user_id == user_id, Trade.is_deleted.is_(False)).limit(400)).all()
    for trade in trades:
        add(trade.setup_tag)
        add(trade.session)
        for tag in trade.setup_tags or []:
            add(str(tag))
    playbooks = db.scalars(select(Playbook).where(Playbook.user_id == user_id, Playbook.is_archived.is_(False))).all()
    for playbook in playbooks:
        add(playbook.name)
        for tag in playbook.tags or []:
            add(str(tag))
    return labels


def build_trade_context(db: Session, user_id: uuid.UUID, trade_ids: list[uuid.UUID], instructions: str) -> dict:
    trades = load_trades(db, user_id, trade_ids=trade_ids)
    names = _playbook_names(db, trades)
    return {
        "kind": "trades",
        "instructions": instructions[:2000],
        "catalog": tag_catalog(db, user_id),
        "trades": [_trade_payload(trade, names.get(trade.playbook_id)) for trade in trades],
        "trade_count": len(trades),
    }


def build_session_context(db: Session, user_id: uuid.UUID, account_id: uuid.UUID | None, day: date | None) -> dict:
    trades = load_trades(db, user_id, day=day, account_id=account_id)
    names = _playbook_names(db, trades)
    note = None
    recap = None
    if account_id and day:
        journal = db.scalar(
            select(DayNote).where(
                DayNote.user_id == user_id,
                DayNote.account_id == account_id,
                DayNote.date == day,
                DayNote.kind == "journal",
            )
        )
        if journal and (journal.content or "").strip():
            note = journal.content[:2000]
        row = db.scalar(
            select(DailyRecap).where(
                DailyRecap.user_id == user_id,
                DailyRecap.account_id == account_id,
                DailyRecap.date == day,
            )
        )
        if row:
            recap = {
                "reflection": (row.reflection or "")[:1000],
                "best_decision": (row.best_decision or "")[:500],
                "work_on": list(row.work_on or []),
            }
    playbooks = db.scalars(select(Playbook).where(Playbook.user_id == user_id, Playbook.is_archived.is_(False)).limit(20)).all()
    return {
        "kind": "session",
        "date": day.isoformat() if day else None,
        "account_id": str(account_id) if account_id else None,
        "trades": [_trade_payload(trade, names.get(trade.playbook_id)) for trade in trades],
        "trade_count": len(trades),
        "journal_note": note,
        "recap": recap,
        "playbooks": [{"name": item.name, "rules": item.rules or {}, "tags": list(item.tags or [])} for item in playbooks],
    }


def build_performance_context(db: Session, user_id: uuid.UUID, symbols: list[str]) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=30)
    trades = load_trades(db, user_id, since=since)
    if symbols:
        wanted = {symbol.upper() for symbol in symbols}
        scoped = [trade for trade in trades if trade.symbol.upper() in wanted]
    else:
        scoped = trades
    pnl = [float(trade.pnl) for trade in scoped if trade.pnl is not None]
    winners = sum(1 for value in pnl if value > 0)
    return {
        "window": "30d",
        "symbols": symbols,
        "trade_count": len(scoped),
        "net_pnl": round(sum(pnl), 2) if pnl else 0.0,
        "win_rate": round((winners / len(pnl)) * 100, 1) if pnl else None,
    }


def build_market_context(db: Session, user_id: uuid.UUID, account_id: uuid.UUID | None, day: date | None, configuration: dict, instructions: str) -> dict:
    symbols = [str(symbol).upper() for symbol in configuration.get("symbols") or []]
    warnings: list[str] = []
    news: list[dict] = []
    if configuration.get("include_news", True) and symbols:
        from app.services.ai.tools.web import fetch_news_items

        for symbol in symbols:
            try:
                items = fetch_news_items(symbol, limit=3)
            except Exception:
                warnings.append(f"Market data was unavailable for {symbol}.")
                continue
            if not items:
                warnings.append(f"{symbol} had no recent headlines.")
            news.append({"symbol": symbol, "items": items})
    events: list[dict] = []
    if configuration.get("include_events", True) and account_id and day:
        plan = db.scalar(
            select(DayPlan).where(DayPlan.user_id == user_id, DayPlan.account_id == account_id, DayPlan.date == day)
        )
        if plan:
            events = [
                {"title": event.title, "impact": event.impact, "note": event.note, "date": event.occurs_on.isoformat()}
                for event in plan.events
            ]
    performance = None
    if configuration.get("include_performance", True):
        performance = build_performance_context(db, user_id, symbols)
    return {
        "kind": "market",
        "date": day.isoformat() if day else None,
        "account_id": str(account_id) if account_id else None,
        "symbols": symbols,
        "instructions": instructions[:2000],
        "news": news,
        "events": events,
        "performance": performance,
        "warnings": warnings,
    }
