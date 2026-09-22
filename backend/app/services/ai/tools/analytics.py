from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import select

from app.core.config import settings
from app.models.account import Account
from app.models.trade import Trade, TradeStatus
from app.services import stats_service
from app.services.ai.tools.context import SourceRef, ToolContext
from app.services.ai.tools.filters import (
    compact_overview,
    normalize_session,
    normalize_side,
    parse_datetime,
    trade_session_label,
)


def _owned_account_id(ctx: ToolContext) -> uuid.UUID | None:
    if ctx.account_id is None:
        return None
    account = ctx.db.get(Account, ctx.account_id)
    if account is None or account.user_id != ctx.user_id:
        ctx.warnings.append("The requested account was ignored because it does not belong to you.")
        ctx.account_id = None
        return None
    return ctx.account_id


def _filtered_trades(ctx: ToolContext, args: dict) -> list[Trade]:
    account_id = _owned_account_id(ctx)
    trades = stats_service._closed_trades(ctx.db, ctx.user_id, account_id=account_id)
    session = normalize_session(args.get("session"))
    trades = stats_service.filter_trades(
        trades,
        date_from=parse_datetime(args.get("date_from")),
        date_to=parse_datetime(args.get("date_to")),
        setup_tag=str(args["setup"]).strip() if args.get("setup") else None,
        symbol=str(args["symbol"]).strip().upper() if args.get("symbol") else None,
        session=session if session in {"Asia", "London", "Overlap", "NY", "Off"} else None,
    )
    side = normalize_side(args.get("direction") or args.get("side"))
    if side:
        trades = [t for t in trades if getattr(t.side, "value", t.side) == side]
    if session and session not in {"Asia", "London", "Overlap", "NY", "Off"}:
        needle = session.lower()
        trades = [
            t
            for t in trades
            if (t.session or "").lower() == needle or (trade_session_label(t) or "").lower() == needle
        ]
    tags = args.get("tags")
    if isinstance(tags, str) and tags.strip():
        tags = [tags]
    if isinstance(tags, list) and tags:
        needles = {str(tag).strip().lower() for tag in tags if str(tag).strip()}
        if needles:
            trades = [t for t in trades if _trade_has_tag(t, needles)]
    return trades


def _trade_has_tag(trade: Trade, needles: set[str]) -> bool:
    values = [trade.setup_tag, *(trade.setup_tags or []), *(trade.emotion_tags or []), *(trade.rules_broken or [])]
    lowered = {str(value).strip().lower() for value in values if value}
    return bool(lowered & needles)


def get_trade_statistics(ctx: ToolContext, args: dict) -> dict:
    trades = _filtered_trades(ctx, args)
    overview = compact_overview(stats_service.overview_from_trades(trades))
    overview["insufficient_data"] = overview["total_trades"] == 0
    overview["filters"] = {
        "date_from": args.get("date_from"),
        "date_to": args.get("date_to"),
        "symbol": args.get("symbol"),
        "setup": args.get("setup"),
        "session": normalize_session(args.get("session")),
        "direction": normalize_side(args.get("direction") or args.get("side")),
    }
    return overview


def get_trade_history(ctx: ToolContext, args: dict) -> dict:
    account_id = _owned_account_id(ctx)
    limit = args.get("limit") or settings.ai_max_trade_results
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = settings.ai_max_trade_results
    limit = max(1, min(limit, settings.ai_max_trade_results))

    stmt = (
        select(Trade)
        .where(
            Trade.user_id == ctx.user_id,
            Trade.is_deleted.is_(False),
            Trade.status == TradeStatus.closed,
            Trade.pnl.is_not(None),
        )
        .order_by(Trade.opened_at.desc())
        .limit(limit)
    )
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    trades = list(ctx.db.scalars(stmt).all())
    trades = _apply_history_filters(trades, args)
    rows = []
    for trade in trades:
        opened = trade.opened_at
        notes = (trade.notes or "").strip()
        rows.append(
            {
                "id": str(trade.id),
                "date": opened.date().isoformat() if opened else None,
                "symbol": trade.symbol,
                "side": getattr(trade.side, "value", trade.side),
                "setup": trade.setup_tag,
                "session": trade_session_label(trade),
                "pnl": round(float(trade.pnl or 0), 2),
                "mood": trade.mood,
                "notes": notes[:240] if notes else None,
            }
        )
        if notes:
            ctx.add_source(
                SourceRef(
                    type="trade",
                    id=str(trade.id),
                    title=f"{trade.symbol} {(opened.date().isoformat() if opened else '')}".strip(),
                    date=opened.date().isoformat() if opened else None,
                )
            )
    return {"trades": rows, "count": len(rows), "insufficient_data": len(rows) == 0}


def _apply_history_filters(trades: list[Trade], args: dict) -> list[Trade]:
    from app.services.ai.tools.filters import parse_datetime

    date_from = parse_datetime(args.get("date_from"))
    date_to = parse_datetime(args.get("date_to"))
    setup = str(args["setup"]).strip() if args.get("setup") else None
    symbol = str(args["symbol"]).strip().upper() if args.get("symbol") else None
    session = normalize_session(args.get("session"))
    out = trades
    if date_from:
        out = [t for t in out if t.opened_at and t.opened_at >= date_from]
    if date_to:
        out = stats_service.filter_trades(out, date_to=date_to)
    if setup:
        out = [t for t in out if t.setup_tag == setup or setup in (t.setup_tags or [])]
    if symbol:
        out = [t for t in out if t.symbol.upper() == symbol]
    if session:
        if session in {"Asia", "London", "Overlap", "NY", "Off"}:
            out = [t for t in out if stats_service._session_for_hour(t.opened_at.hour) == session]
        else:
            needle = session.lower()
            out = [t for t in out if (t.session or "").lower() == needle]
    return out


def get_setup_statistics(ctx: ToolContext, args: dict) -> dict:
    trades = _filtered_trades(ctx, args)
    buckets: dict[str, list[Trade]] = defaultdict(list)
    for trade in trades:
        tags = list(trade.setup_tags or [])
        if trade.setup_tag and trade.setup_tag not in tags:
            tags.append(trade.setup_tag)
        if args.get("setup"):
            wanted = str(args["setup"]).strip().lower()
            tags = [tag for tag in tags if tag.lower() == wanted]
        for tag in tags:
            buckets[tag].append(trade)
    rows = []
    for setup, group in buckets.items():
        overview = compact_overview(stats_service.overview_from_trades(group))
        rows.append({"setup": setup, **overview})
    rows.sort(key=lambda row: (row.get("total_pnl") is not None, row.get("total_pnl") or 0), reverse=True)
    return {"setups": rows, "insufficient_data": len(rows) == 0}


def get_session_statistics(ctx: ToolContext, args: dict) -> dict:
    trades = _filtered_trades(ctx, {k: v for k, v in args.items() if k != "session"})
    wanted = normalize_session(args.get("session"))
    grouped = {"Asia": [], "London": [], "Overlap": [], "NY": [], "Off": []}
    for trade in trades:
        grouped[stats_service._session_for_hour(trade.opened_at.hour)].append(trade)
    rows = []
    for name in ("Asia", "London", "Overlap", "NY", "Off"):
        if wanted and name != wanted:
            continue
        group = grouped[name]
        overview = compact_overview(stats_service.overview_from_trades(group))
        rows.append({"session": name, **overview})
    return {"sessions": rows, "insufficient_data": all(row["total_trades"] == 0 for row in rows)}


def get_symbol_statistics(ctx: ToolContext, args: dict) -> dict:
    trades = _filtered_trades(ctx, args)
    buckets: dict[str, list[Trade]] = defaultdict(list)
    for trade in trades:
        buckets[trade.symbol.upper()].append(trade)
    rows = []
    for symbol, group in buckets.items():
        overview = compact_overview(stats_service.overview_from_trades(group))
        rows.append({"symbol": symbol, **overview})
    rows.sort(key=lambda row: abs(float(row.get("total_pnl") or 0)), reverse=True)
    return {"symbols": rows[:20], "insufficient_data": len(rows) == 0}


def get_tag_statistics(ctx: ToolContext, args: dict) -> dict:
    trades = _filtered_trades(ctx, args)
    setup_rows = stats_service.expectancy_by_tag(trades, "setup")
    emotion_rows = stats_service.expectancy_by_tag(trades, "emotion")
    return {
        "setup_tags": setup_rows,
        "emotion_tags": emotion_rows,
        "insufficient_data": not setup_rows and not emotion_rows,
    }


def get_drawdown_statistics(ctx: ToolContext, args: dict) -> dict:
    trades = _filtered_trades(ctx, args)
    overview = compact_overview(stats_service.overview_from_trades(trades))
    return {
        "max_drawdown": overview["max_drawdown"],
        "max_drawdown_pct": overview["max_drawdown_pct"],
        "current_streak": overview["current_streak"],
        "current_streak_type": overview["current_streak_type"],
        "largest_loss": overview["largest_loss"],
        "largest_win": overview["largest_win"],
        "total_trades": overview["total_trades"],
        "insufficient_data": overview["total_trades"] == 0,
    }
