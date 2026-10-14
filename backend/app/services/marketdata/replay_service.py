"""Replay payloads (03 section 3.2). One builder serves journal, session and run trades (D-021)."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.backtest import TradeReplayNote
from app.models.time_offset import AccountTimeOffset
from app.models.trade import Trade
from app.models.user import User
from app.schemas.replay import (
    AlignmentOut,
    AlignmentPoint,
    OffsetSuggestion,
    ReplayNoteIn,
    ReplayNoteOut,
    ReplayPayload,
    ReplayTradeOut,
    TimeBasisOut,
)
from app.services.backtest.errors import BacktestError, not_found
from app.services.live_trades import get_live_trade
from app.services.marketdata.aggregation import ceil_to, floor_to, timeframe_ms
from app.services.marketdata.candle_service import ensure_candles
from app.services.marketdata.candles import MINUTE_MS
from app.services.marketdata.read_api import to_instrument_out
from app.services.marketdata.registry import InstrumentSpec
from app.services.marketdata.resolver import resolve_symbol
from app.services.marketdata.store import CandleStore, get_store
from app.services.marketdata.time_offsets import effective_utc, tolerance

HOUR_MS = 60 * MINUTE_MS
DAY_MS = 24 * HOUR_MS


@dataclass(frozen=True)
class ReplayTradeDescriptor:
    source: Literal["journal", "session", "run"]
    trade_ref: str
    user_id: uuid.UUID
    broker: str | None
    raw_symbol: str
    side: Literal["long", "short"]
    size: float
    entry_ms: int
    entry_price: float
    exit_ms: int | None = None
    exit_price: float | None = None
    stop_loss: float | None = None
    take_profit: float | None = None
    fees: float | None = None
    market_type: str | None = None
    time_basis: str = "utc_aware"
    time_rule: str = "utc_aware"
    tz_label: str | None = None


def default_timeframe(duration_ms: int) -> str:
    if duration_ms < 30 * MINUTE_MS:
        return "1m"
    if duration_ms < 2 * HOUR_MS:
        return "5m"
    if duration_ms < DAY_MS:
        return "15m"
    if duration_ms < 7 * DAY_MS:
        return "1h"
    return "4h"


def holding_ms(descriptor: ReplayTradeDescriptor, now_ms: int) -> int:
    end = descriptor.exit_ms if descriptor.exit_ms is not None else now_ms
    return max(0, end - descriptor.entry_ms)


def replay_window(entry_ms: int, exit_ms: int | None, timeframe: str, now_ms: int) -> tuple[int, int]:
    """1m data needed: 200 bars before entry to 100 bars after exit, padded by a day (02 section 11),
    never past the last closed minute."""
    step = timeframe_ms(timeframe)
    start = floor_to(entry_ms - settings.replay_window_bars_before * step - DAY_MS, MINUTE_MS)
    end = ceil_to((exit_ms if exit_ms is not None else entry_ms) + settings.replay_window_bars_after * step + DAY_MS, MINUTE_MS)
    return start, min(end, floor_to(now_ms, MINUTE_MS))


def suggested_start(entry_ms: int, timeframe: str) -> int:
    step = timeframe_ms(timeframe)
    return floor_to(entry_ms, step) - settings.replay_suggested_start_bars * step


def _point(store: CandleStore, spec: InstrumentSpec, at_ms: int, price: float, tol: float) -> AlignmentPoint:
    minute = floor_to(at_ms, MINUTE_MS)
    bar = store.read(spec.source, spec.symbol, minute, minute + MINUTE_MS)
    if not len(bar):
        return AlignmentPoint(price=price, candle_low=None, candle_high=None, status="no_candle")
    low, high = float(bar.low[0]), float(bar.high[0])
    if low - tol <= price <= high + tol:
        return AlignmentPoint(price=price, candle_low=low, candle_high=high, status="inside")
    outside_by = price - high if price > high else price - low
    return AlignmentPoint(price=price, candle_low=low, candle_high=high, status="outside", outside_by=outside_by)


def alignment(store: CandleStore, spec: InstrumentSpec, d: ReplayTradeDescriptor) -> AlignmentOut:
    tol = tolerance(spec, d.entry_price)
    entry = _point(store, spec, d.entry_ms, d.entry_price, tol)
    exit_point = None
    if d.exit_ms is not None and d.exit_price is not None:
        exit_point = _point(store, spec, d.exit_ms, d.exit_price, tol)
    suggestion = None
    for name, point in (("entry", entry), ("exit", exit_point)):
        if point is not None and point.status == "outside":
            suggestion = OffsetSuggestion(based_on=name, price_delta=-point.outside_by, points=-point.outside_by / spec.pip_size)
            break
    return AlignmentOut(tolerance=tol, entry=entry, exit=exit_point, offset_suggestion=suggestion)


def resolve_instrument(db: Session, d: ReplayTradeDescriptor) -> tuple[InstrumentSpec, str | None]:
    resolution = resolve_symbol(db, d.broker, d.raw_symbol, market_type=d.market_type)
    db.commit()
    spec = resolution.instrument
    if spec is None:
        raise BacktestError(
            "unresolved_symbol",
            "Replay isn't available for this symbol yet.",
            details={"raw_symbol": d.raw_symbol, "broker": resolution.broker},
        )
    if not spec.enabled:
        raise BacktestError(
            "instrument_not_supported",
            f"Replay for {spec.symbol} isn't switched on yet.",
            details={"symbol": spec.symbol},
        )
    return spec, resolution.price_note


def build_replay_payload(
    db: Session,
    descriptor: ReplayTradeDescriptor,
    *,
    store: CandleStore | None = None,
    now_ms: int | None = None,
) -> ReplayPayload:
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    spec, price_note = resolve_instrument(db, descriptor)
    timeframe = default_timeframe(holding_ms(descriptor, now))
    window_start, window_end = replay_window(descriptor.entry_ms, descriptor.exit_ms, timeframe, now)
    status, job_id = "ready", None
    if window_end > window_start:
        ensured = ensure_candles(db, spec, window_start, window_end, owner_user_id=descriptor.user_id)
        if not ensured.ready:
            status, job_id = "preparing", ensured.job_id
    return ReplayPayload(
        status=status,
        job_id=job_id,
        source=descriptor.source,
        trade_ref=descriptor.trade_ref,
        instrument=to_instrument_out(spec),
        trade=ReplayTradeOut(
            side=descriptor.side,
            size=descriptor.size,
            entry_ms=descriptor.entry_ms,
            entry_price=descriptor.entry_price,
            exit_ms=descriptor.exit_ms,
            exit_price=descriptor.exit_price,
            stop_loss=descriptor.stop_loss,
            take_profit=descriptor.take_profit,
            fees=descriptor.fees,
        ),
        default_timeframe=timeframe,
        suggested_start_ms=suggested_start(descriptor.entry_ms, timeframe),
        window_start_ms=window_start,
        window_end_ms=window_end,
        alignment=alignment(store or get_store(), spec, descriptor) if status == "ready" else None,
        time_basis=TimeBasisOut(basis=descriptor.time_basis, rule=descriptor.time_rule, tz_label=descriptor.tz_label),
        price_note=price_note,
    )


def _float(value) -> float | None:
    return None if value is None else float(value)


def journal_descriptor(db: Session, trade: Trade) -> ReplayTradeDescriptor:
    user = db.get(User, trade.user_id)
    offset = db.get(AccountTimeOffset, trade.account_id)
    tz = user.timezone if user else None
    entry = effective_utc(trade.opened_at, trade.time_basis, offset, tz)
    exit_ms = None
    if trade.closed_at is not None:
        exit_ms = int(effective_utc(trade.closed_at, trade.time_basis, offset, tz).utc.timestamp() * 1000)
    costs = [float(v) for v in (trade.fees, trade.commission) if v is not None]
    fees = sum(costs) if costs else None
    broker = trade.source.split(":", 1)[1] if trade.source and ":" in trade.source else None
    side = trade.side.value if hasattr(trade.side, "value") else str(trade.side)
    return ReplayTradeDescriptor(
        source="journal",
        trade_ref=str(trade.id),
        user_id=trade.user_id,
        broker=broker,
        raw_symbol=trade.canonical_symbol or trade.provider_symbol or trade.symbol,
        side=side,
        size=float(trade.quantity),
        entry_ms=int(entry.utc.timestamp() * 1000),
        entry_price=float(trade.entry_price),
        exit_ms=exit_ms,
        exit_price=_float(trade.exit_price),
        stop_loss=_float(trade.stop_loss),
        take_profit=_float(trade.profit_target),
        fees=fees,
        time_basis=trade.time_basis,
        time_rule=entry.rule,
        tz_label=entry.tz_label,
    )


def _owned_trade(db: Session, user: User, trade_id: uuid.UUID) -> Trade:
    trade = get_live_trade(db, user.id, trade_id, include_deleted=False)
    if trade is None:
        raise not_found("Trade")
    return trade


def journal_replay(db: Session, user: User, trade_id: uuid.UUID) -> ReplayPayload:
    return build_replay_payload(db, journal_descriptor(db, _owned_trade(db, user, trade_id)))


def _note_out(note: TradeReplayNote) -> ReplayNoteOut:
    return ReplayNoteOut(id=str(note.id), replay_time_ms=note.replay_time_ms, text=note.text, created_at=note.created_at)


def list_notes(db: Session, user: User, trade_id: uuid.UUID) -> list[ReplayNoteOut]:
    _owned_trade(db, user, trade_id)
    notes = db.scalars(
        select(TradeReplayNote)
        .where(TradeReplayNote.user_id == user.id, TradeReplayNote.trade_id == trade_id)
        .order_by(TradeReplayNote.replay_time_ms, TradeReplayNote.created_at)
    )
    return [_note_out(n) for n in notes]


def add_note(db: Session, user: User, trade_id: uuid.UUID, payload: ReplayNoteIn) -> ReplayNoteOut:
    _owned_trade(db, user, trade_id)
    note = TradeReplayNote(user_id=user.id, trade_id=trade_id, replay_time_ms=payload.replay_time_ms, text=payload.text)
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_out(note)
