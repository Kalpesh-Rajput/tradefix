"""Build CSV, Excel, and XML trade exports for the authenticated user."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, time, timezone
from xml.etree import ElementTree as ET

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.account import Account
from app.models.trade import Trade
from app.schemas.trade_export import TradeExportFilters, TradeExportRequest

_COLUMNS: list[tuple[str, str, str]] = [
    ("Trade ID", "id", "text"),
    ("Account", "account", "text"),
    ("Symbol", "symbol", "text"),
    ("Asset Type", "asset_type", "text"),
    ("Side", "side", "text"),
    ("Strategy", "strategy", "text"),
    ("Setups", "setups", "text"),
    ("Quantity", "quantity", "price"),
    ("Entry Price", "entry_price", "price"),
    ("Exit Price", "exit_price", "price"),
    ("Stop Loss", "stop_loss", "price"),
    ("Take Profit", "take_profit", "price"),
    ("Entry Date/Time", "entry_time", "datetime"),
    ("Exit Date/Time", "exit_time", "datetime"),
    ("Duration", "duration", "text"),
    ("P&L", "pnl", "money"),
    ("P&L %", "pnl_percent", "percent"),
    ("Gross P&L", "gross_pnl", "money"),
    ("Commission", "commission", "money"),
    ("Fees", "fees", "money"),
    ("Swap", "swap", "money"),
    ("Funding", "funding", "money"),
    ("Risk Amount", "risk_amount", "money"),
    ("R Multiple", "r_multiple", "number"),
    ("Status", "status", "text"),
    ("Entry Condition", "entry_condition", "text"),
    ("Exit Condition", "exit_condition", "text"),
    ("Timeframe", "timeframe", "text"),
    ("Analysis Timeframe", "analysis_timeframe", "text"),
    ("Session", "session", "text"),
    ("Trade Type", "trade_type", "text"),
    ("Option Type", "option_type", "text"),
    ("Strike", "strike_price", "price"),
    ("Expiry", "expiry", "text"),
    ("Rating", "rating", "number"),
    ("Mood", "mood", "text"),
    ("Emotions", "emotions", "text"),
    ("Rules Broken", "rules_broken", "text"),
    ("Plan Compliance", "plan_compliance", "number"),
    ("Notes", "notes", "text"),
    ("Source", "source", "text"),
    ("External ID", "external_trade_id", "text"),
    ("Created At", "created_at", "datetime"),
]

# Same columns as the Trade View column picker, in that order.
_CHOICE_COLUMNS: dict[str, tuple[str, str, str]] = {
    "date": ("Date", "date", "text"),
    "ticker": ("Ticker", "symbol", "text"),
    "class": ("Class", "asset_type", "text"),
    "side": ("Side", "side", "text"),
    "qty": ("Qty", "quantity", "price"),
    "entry": ("Entry", "entry_price", "price"),
    "exit": ("Exit", "exit_price", "price"),
    "strategy": ("Strategy", "strategy", "text"),
    "pnl": ("P&L", "pnl", "money"),
    "roi": ("Net ROI", "pnl_percent", "percent"),
    "notes": ("Notes", "notes", "text"),
    "entryTime": ("Entry Time", "entry_time", "datetime"),
    "exitTime": ("Exit Time", "exit_time", "datetime"),
    "held": ("Held", "duration", "text"),
    "fees": ("Fees", "fees", "money"),
    "risk": ("Trade Risk", "risk_amount", "money"),
    "rMultiple": ("Realized R-Multiple", "r_multiple", "number"),
    "status": ("Status", "status", "text"),
    "session": ("Session", "session", "text"),
    "mood": ("Mood", "mood", "text"),
    "emotion": ("Emotion", "emotions", "text"),
    "rating": ("Trade Rating", "rating", "number"),
    "account": ("Account", "account", "text"),
    "stop": ("Stop loss", "stop_loss", "price"),
    "target": ("Profit Target", "take_profit", "price"),
    "leverage": ("Leverage", "leverage", "number"),
    "tradeType": ("Trade type", "trade_type", "text"),
    "rules": ("Rules", "rules_broken", "text"),
}


class EmptyExport(Exception):
    """No trades matched the requested scope."""


def export_filename(scope: str, export_format: str, on: date | None = None) -> str:
    stamp = (on or datetime.now(timezone.utc).date()).isoformat()
    if scope == "custom":
        prefix = "tradefix_trades_custom"
    elif scope == "filtered":
        prefix = "tradefix_trades_filtered"
    else:
        prefix = "tradefix_trades"
    extension = "xlsx" if export_format == "xlsx" else export_format
    return f"{prefix}_{stamp}.{extension}"


def columns_for_export(scope: str, selected: list[str] | None) -> list[tuple[str, str, str]]:
    if scope != "custom":
        return _COLUMNS
    wanted = set(selected or [])
    if not wanted:
        raise ValueError("columns required")
    unknown = wanted.difference(_CHOICE_COLUMNS)
    if unknown:
        raise ValueError("invalid column")
    return [_CHOICE_COLUMNS[column_id] for column_id in _CHOICE_COLUMNS if column_id in wanted]


def count_trades_for_export(
    db: Session,
    user_id: uuid.UUID,
    *,
    scope: str,
    pnl_display_mode: str,
    filters: TradeExportFilters,
) -> int:
    return len(_select_trades(db, user_id, scope=scope, pnl_display_mode=pnl_display_mode, filters=filters))


def build_trade_export(
    db: Session,
    user_id: uuid.UUID,
    request: TradeExportRequest,
) -> tuple[bytes, str, str, int]:
    trades = _select_trades(
        db,
        user_id,
        scope=request.scope,
        pnl_display_mode=request.pnl_display_mode,
        filters=request.filters,
    )
    if not trades:
        raise EmptyExport
    columns = columns_for_export(request.scope, request.columns)
    rows = [trade_export_row(trade) for trade in trades]
    if request.format == "csv":
        payload = render_csv(rows, columns)
        media = "text/csv; charset=utf-8"
    elif request.format == "xlsx":
        payload = render_xlsx(rows, columns)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        payload = render_xml(rows, columns)
        media = "application/xml; charset=utf-8"
    filename = export_filename(request.scope, request.format)
    return payload, media, filename, len(rows)


def trade_export_row(trade: Trade) -> dict:
    pnl = _float(trade.pnl)
    invested_roi = _roi_pct(trade, pnl)
    opened = _as_utc(trade.opened_at)
    closed = _as_utc(trade.closed_at)
    created = _as_utc(trade.created_at)
    account = trade.account.name if getattr(trade, "account", None) is not None else ""
    moods = _mood_labels(trade)
    return {
        "id": str(trade.id),
        "account": account,
        "date": _date_prefix(trade.closed_at or trade.opened_at),
        "symbol": trade.symbol or "",
        "asset_type": _enum_text(trade.asset_type),
        "side": _enum_text(trade.side),
        "strategy": (trade.strategy_name or trade.setup_tag or "").strip(),
        "setups": _join(trade.setup_tags),
        "quantity": _float(trade.quantity),
        "entry_price": _float(trade.entry_price),
        "exit_price": _float(trade.exit_price),
        "stop_loss": _float(trade.stop_loss),
        "take_profit": _float(trade.profit_target),
        "entry_time": opened,
        "exit_time": closed,
        "duration": _duration_label(opened, closed),
        "pnl": pnl,
        "pnl_percent": invested_roi,
        "gross_pnl": _float(trade.gross_pnl),
        "commission": _float(trade.commission),
        "fees": _float(trade.fees) if trade.fees is not None else 0.0,
        "swap": _float(trade.swap),
        "funding": _float(trade.funding),
        "risk_amount": _float(trade.risk_amount),
        "r_multiple": _r_multiple(trade),
        "status": _enum_text(trade.status),
        "entry_condition": trade.entry_condition or "",
        "exit_condition": trade.exit_condition or "",
        "timeframe": trade.entry_timeframe or "",
        "analysis_timeframe": trade.analysis_timeframe or "",
        "session": trade.session or "",
        "trade_type": trade.trade_type or "",
        "leverage": _float(getattr(trade, "leverage", None)),
        "option_type": trade.option_type or "",
        "strike_price": _float(trade.strike_price),
        "expiry": trade.expiry_date.isoformat() if trade.expiry_date else "",
        "rating": trade.rating,
        "mood": _join(moods),
        "emotions": _join(trade.emotion_tags),
        "rules_broken": _join(trade.rules_broken),
        "plan_compliance": trade.plan_compliance,
        "notes": trade.notes or "",
        "source": trade.source or "",
        "external_trade_id": trade.external_trade_id or "",
        "created_at": created,
    }


def render_csv(rows: list[dict], columns: list[tuple[str, str, str]] | None = None) -> bytes:
    chosen = columns or _COLUMNS
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    writer.writerow([header for header, _, _ in chosen])
    for row in rows:
        writer.writerow([_csv_cell(row.get(key), kind) for _, key, kind in chosen])
    return buffer.getvalue().encode("utf-8-sig")


def render_xml(rows: list[dict], columns: list[tuple[str, str, str]] | None = None) -> bytes:
    chosen = columns or _COLUMNS
    root = ET.Element("tradefix")
    trades = ET.SubElement(root, "trades")
    for row in rows:
        node = ET.SubElement(trades, "trade")
        for _, key, kind in chosen:
            child = ET.SubElement(node, key)
            child.text = _csv_cell(row.get(key), kind)
    return ET.tostring(root, encoding="UTF-8", xml_declaration=True)


def render_xlsx(rows: list[dict], columns: list[tuple[str, str, str]] | None = None) -> bytes:
    chosen = columns or _COLUMNS
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Trades"
    header_font = Font(bold=True, color="1F2937")
    header_fill = PatternFill("solid", fgColor="F4F4F6")
    for index, (header, _, _) in enumerate(chosen, start=1):
        cell = sheet.cell(1, index, header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(vertical="center")
    for row_index, row in enumerate(rows, start=2):
        for col_index, (_, key, kind) in enumerate(chosen, start=1):
            value = row.get(key)
            cell = sheet.cell(row_index, col_index, _excel_value(value, kind))
            if kind == "money":
                cell.number_format = '#,##0.00'
            elif kind == "price":
                cell.number_format = '#,##0.00####'
            elif kind == "percent":
                cell.number_format = '0.00'
            elif kind == "number":
                cell.number_format = "0.000"
            elif kind == "datetime" and isinstance(value, datetime):
                cell.number_format = "yyyy-mm-dd hh:mm"
            if key == "notes":
                cell.alignment = Alignment(wrap_text=True, vertical="top")
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:{get_column_letter(len(chosen))}{len(rows) + 1}"
    sheet.row_dimensions[1].height = 22
    for index, (header, key, _) in enumerate(chosen, start=1):
        width = 42 if key == "notes" else min(max(len(header) + 3, 14), 28)
        sheet.column_dimensions[get_column_letter(index)].width = width

    summary = workbook.create_sheet("Summary")
    summary["A1"] = "Metric"
    summary["B1"] = "Value"
    summary["A1"].font = header_font
    summary["B1"].font = header_font
    summary["A1"].fill = header_fill
    summary["B1"].fill = header_fill
    for offset, (label, value, number_format) in enumerate(_summary_rows(rows), start=2):
        summary.cell(offset, 1, label)
        cell = summary.cell(offset, 2, value)
        if number_format:
            cell.number_format = number_format
    summary.column_dimensions["A"].width = 28
    summary.column_dimensions["B"].width = 22
    summary.freeze_panes = "A2"

    out = io.BytesIO()
    workbook.save(out)
    return out.getvalue()


def matches_export_filters(trade: Trade, filters: TradeExportFilters, pnl_display_mode: str) -> bool:
    """Mirror Trade View `matchesTrade`, including the account date window applied by the list API."""

    if filters.status != "all" and _enum_text(trade.status) != filters.status:
        return False
    if filters.asset_type and _enum_text(trade.asset_type) != filters.asset_type:
        return False
    if filters.side and _enum_text(trade.side) != filters.side:
        return False
    if filters.symbol and not _same(trade.symbol, filters.symbol):
        return False
    if filters.session and not _same(trade.session, filters.session):
        return False
    if filters.setup_tag and not _strategy_matches(trade, filters.setup_tag):
        return False
    if filters.holding and _holding(trade, filters.today) != filters.holding:
        return False
    if filters.weekday and _weekday(trade) != filters.weekday:
        return False
    if filters.mood and not any(_same(mood, filters.mood) for mood in _mood_labels(trade)):
        return False
    if filters.emotion and not any(_same(tag, filters.emotion) for tag in list(trade.emotion_tags or [])):
        return False

    search = filters.search.strip().casefold()
    if search:
        hay = " ".join(
            [
                trade.symbol or "",
                trade.setup_tag or "",
                trade.strategy_name or "",
                trade.notes or "",
            ]
        ).casefold()
        if search not in hay:
            return False

    pnl = _display_pnl(trade, pnl_display_mode)
    if filters.pnl == "profit" and not (pnl is not None and pnl > 0):
        return False
    if filters.pnl == "loss" and not (pnl is not None and pnl < 0):
        return False
    if filters.pnl == "breakeven" and not (pnl is not None and pnl == 0):
        return False

    roi = _roi_pct(trade, pnl)
    if filters.roi == "positive" and not (roi is not None and roi > 0):
        return False
    if filters.roi == "negative" and not (roi is not None and roi < 0):
        return False

    fees = float(trade.fees or 0)
    if filters.fees == "with" and fees <= 0:
        return False
    if filters.fees == "without" and fees > 0:
        return False

    risk = None if trade.risk_amount is None else float(trade.risk_amount)
    if filters.risk == "with" and not (risk is not None and risk > 0):
        return False
    if filters.risk == "without" and risk is not None and risk > 0:
        return False

    multiple = _r_multiple(trade)
    if filters.r_multiple == "positive" and not (multiple is not None and multiple > 0):
        return False
    if filters.r_multiple == "negative" and not (multiple is not None and multiple < 0):
        return False
    if filters.r_multiple == "none" and multiple is not None:
        return False

    if filters.rating == "unrated" and trade.rating is not None:
        return False
    if filters.rating and filters.rating != "unrated" and str(trade.rating if trade.rating is not None else "") != filters.rating:
        return False

    journaled = bool((trade.notes or "").strip()) or len(list(trade.screenshot_urls or [])) > 0
    if filters.journal == "journaled" and not journaled:
        return False
    if filters.journal == "unjournaled" and journaled:
        return False

    broken = len(list(trade.rules_broken or [])) > 0
    if filters.rules == "broken" and not broken:
        return False
    if filters.rules == "clean" and broken:
        return False
    return True


def _select_trades(
    db: Session,
    user_id: uuid.UUID,
    *,
    scope: str,
    pnl_display_mode: str,
    filters: TradeExportFilters,
) -> list[Trade]:
    stmt = (
        select(Trade)
        .options(selectinload(Trade.account))
        .where(Trade.user_id == user_id, Trade.is_deleted.is_(False))
        .order_by(Trade.opened_at.desc())
    )
    if scope in {"filtered", "custom"}:
        if filters.account_id is None:
            return []
        account = db.get(Account, filters.account_id)
        if account is None or account.user_id != user_id:
            raise LookupError("account")
        stmt = stmt.where(Trade.account_id == filters.account_id)
        start = _day_bound(filters.date_from, end=False)
        end = _day_bound(filters.date_to, end=True)
        if start is not None:
            stmt = stmt.where(Trade.opened_at >= start)
        if end is not None:
            stmt = stmt.where(Trade.opened_at <= end)
        id_list = _parse_ids(filters.ids)
        if id_list:
            stmt = stmt.where(Trade.id.in_(id_list))
        if filters.auto_flag:
            stmt = stmt.where(Trade.auto_flags.contains([filters.auto_flag]))

    trades = list(db.scalars(stmt).all())
    if scope not in {"filtered", "custom"}:
        return trades
    return [trade for trade in trades if matches_export_filters(trade, filters, pnl_display_mode)]


def _summary_rows(rows: list[dict]) -> list[tuple[str, object, str | None]]:
    closed = [row for row in rows if row.get("status") == "closed"]
    open_count = sum(1 for row in rows if row.get("status") == "open")
    with_pnl = [row for row in closed if isinstance(row.get("pnl"), (int, float))]
    wins = [row for row in with_pnl if float(row["pnl"]) > 0]
    losses = [row for row in with_pnl if float(row["pnl"]) < 0]
    total = sum(float(row["pnl"]) for row in with_pnl)
    gross_wins = sum(float(row["pnl"]) for row in wins)
    gross_losses = abs(sum(float(row["pnl"]) for row in losses))
    win_rate = (len(wins) / len(with_pnl) * 100) if with_pnl else None
    average = (total / len(with_pnl)) if with_pnl else None
    profit_factor = (gross_wins / gross_losses) if gross_losses > 0 else None
    durations = [_duration_minutes(row.get("entry_time"), row.get("exit_time")) for row in rows]
    durations = [item for item in durations if item is not None]
    average_duration = _duration_label_minutes(sum(durations) / len(durations)) if durations else ""
    return [
        ("Total Trades", len(rows), "0"),
        ("Open Trades", open_count, "0"),
        ("Closed Trades", len(closed), "0"),
        ("Winning Trades", len(wins), "0"),
        ("Losing Trades", len(losses), "0"),
        ("Win Rate", win_rate if win_rate is not None else "", "0.00" if win_rate is not None else None),
        ("Total P&L", total, '#,##0.00'),
        ("Average P&L", average if average is not None else "", '#,##0.00' if average is not None else None),
        ("Profit Factor", profit_factor if profit_factor is not None else "", "0.00" if profit_factor is not None else None),
        ("Average Trade Duration", average_duration, None),
        ("Date/time zone", "UTC", None),
    ]


def _parse_ids(raw: str) -> list[uuid.UUID]:
    if not raw.strip():
        return []
    parsed: list[uuid.UUID] = []
    for part in raw.split(","):
        text = part.strip()
        if not text:
            continue
        try:
            parsed.append(uuid.UUID(text))
        except ValueError as exc:
            raise ValueError("invalid trade id") from exc
    return parsed


def _day_bound(raw: str | None, *, end: bool) -> datetime | None:
    if not raw:
        return None
    try:
        parsed = date.fromisoformat(raw)
    except ValueError as exc:
        raise ValueError("invalid date") from exc
    clock = time(23, 59, 59) if end else time.min
    return datetime.combine(parsed, clock)


def _display_pnl(trade: Trade, mode: str) -> float | None:
    if trade.pnl is None:
        return None
    pnl = float(trade.pnl)
    if mode == "gross":
        return round(pnl + float(trade.fees or 0), 2)
    return pnl


def _roi_pct(trade: Trade, pnl: float | None) -> float | None:
    if pnl is None:
        return None
    invested = float(trade.invested_amount or 0)
    if invested > 0:
        return (pnl / invested) * 100
    quantity = float(trade.quantity or 0)
    entry = float(trade.entry_price or 0)
    cost = quantity * entry if quantity > 0 and entry > 0 else 0
    if cost <= 0:
        return None
    return (pnl / cost) * 100


def _r_multiple(trade: Trade) -> float | None:
    if trade.pnl is None or trade.risk_amount is None or float(trade.risk_amount) == 0:
        return None
    return round(float(trade.pnl) / float(trade.risk_amount), 3)


def _mood_labels(trade: Trade) -> list[str]:
    extra = trade.extra if isinstance(trade.extra, dict) else {}
    if "moods" in extra:
        return _labels(extra.get("moods"))
    return _labels(trade.mood)


def _labels(value) -> list[str]:
    if isinstance(value, list):
        out: list[str] = []
        seen: set[str] = set()
        for item in value:
            name = " ".join(str(item).split())
            key = name.casefold()
            if not name or key in seen:
                continue
            seen.add(key)
            out.append(name)
        return out
    if isinstance(value, str) and value.strip():
        return _labels([part for part in value.split(",")])
    return []


def _strategy_matches(trade: Trade, tag: str) -> bool:
    names = [trade.setup_tag, trade.strategy_name, *list(trade.setup_tags or [])]
    return any(_same(name, tag) for name in names)


def _holding(trade: Trade, today: str | None) -> str:
    opened = _date_prefix(trade.opened_at)
    if not opened:
        return "multiday"
    if trade.closed_at is None:
        current = today or datetime.now(timezone.utc).date().isoformat()
        return "intraday" if opened == current else "multiday"
    return "intraday" if opened == _date_prefix(trade.closed_at) else "multiday"


def _weekday(trade: Trade) -> str:
    raw = _date_prefix(trade.closed_at or trade.opened_at)
    if not raw:
        return ""
    parsed = date.fromisoformat(raw)
    return str((parsed.weekday() + 1) % 7)


def _date_prefix(value: datetime | date | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    return value.isoformat()


def _same(left, right: str) -> bool:
    return ("" if left is None else str(left)).strip().casefold() == right.strip().casefold()


def _enum_text(value) -> str:
    if value is None:
        return ""
    return str(value.value if hasattr(value, "value") else value)


def _join(value) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        return value
    return "; ".join(str(item) for item in value if item is not None and str(item) != "")


def _float(value) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=None)
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _duration_minutes(opened, closed) -> float | None:
    if not isinstance(opened, datetime) or not isinstance(closed, datetime):
        return None
    seconds = (closed - opened).total_seconds()
    if seconds < 0:
        return 0
    return seconds / 60


def _duration_label(opened: datetime | None, closed: datetime | None) -> str:
    minutes = _duration_minutes(opened, closed)
    if minutes is None:
        return ""
    return _duration_label_minutes(minutes)


def _duration_label_minutes(minutes: float) -> str:
    total = int(minutes)
    if total < 60:
        return f"{total}m"
    hours, mins = divmod(total, 60)
    if hours < 24:
        return f"{hours}h {mins}m"
    days, hours = divmod(hours, 24)
    return f"{days}d {hours}h {mins}m"


def _csv_cell(value, kind: str) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, float):
        if kind == "money" or kind == "percent":
            return f"{value:.2f}"
        if kind == "number":
            return f"{value:.3f}".rstrip("0").rstrip(".")
        text = f"{value:.8f}".rstrip("0").rstrip(".")
        return text or "0"
    return str(value)


def _excel_value(value, kind: str):
    if value is None or value == "":
        return None
    if kind in {"money", "price", "percent", "number"} and isinstance(value, (int, float)):
        return float(value)
    return value
