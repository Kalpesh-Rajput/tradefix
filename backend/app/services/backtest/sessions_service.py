"""Manual session persistence and verification (backtesting/03 sections 3.3 and 6)."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.backtest import BacktestSession, SessionOrder, SessionTrade
from app.models.trade import AssetType, Trade, TradeSide, TradeStatus
from app.models.user import User
from app.schemas.backtest import (
    JournalSaveOut,
    OrderBatch,
    OrderOut,
    SessionCreate,
    SessionDetail,
    SessionStateIn,
    SessionStats,
    SessionSummary,
    TradeBatch,
    TradeOut,
)
from app.schemas.replay import ReplayPayload
from app.services.backtest.errors import BacktestError, not_found
from app.services.backtest.quotas import assert_session_quota, record_session_created
from app.services.backtest.rules import Costs, InstrumentSpec as RuleInstrument, value_closed_trade
from app.services.marketdata.coverage import covered_ranges
from app.services.marketdata.read_api import enabled_instrument
from app.services.marketdata.registry import InstrumentSpec
from app.services.marketdata.replay_service import ReplayTradeDescriptor, build_replay_payload
from app.services.marketdata.store import get_store
from app.services.marketdata.time_offsets import tolerance

MONEY_TOLERANCE = 0.005
BarLookup = Callable[[int], tuple[float, float] | None]


def _num(value) -> float:
    return float(value)


def _session(db: Session, user: User, session_id: uuid.UUID) -> BacktestSession:
    row = db.get(BacktestSession, session_id)
    if row is None or row.user_id != user.id:
        raise not_found("Session")
    return row


def _require_start(db: Session, spec: InstrumentSpec, start_ms: int) -> None:
    ranges = covered_ranges(db, spec.symbol, spec.source)
    if not any(start <= start_ms < end for start, end in ranges):
        raise BacktestError("range_outside_available_data", "That start is outside the stored market data.")


def default_bars(spec: InstrumentSpec) -> BarLookup:
    store = get_store()

    def lookup(time_ms: int) -> tuple[float, float] | None:
        minute = time_ms - time_ms % 60_000
        candles = store.read(spec.source, spec.symbol, minute, minute + 60_000)
        if not len(candles):
            return None
        return float(candles.low[0]), float(candles.high[0])

    return lookup


def create_session(db: Session, user: User, payload: SessionCreate) -> SessionDetail:
    assert_session_quota(db, user)
    spec = enabled_instrument(payload.symbol.upper())
    if payload.end_ms is not None and payload.end_ms <= payload.start_ms:
        raise BacktestError("invalid_request", "The end must be after the start.")
    _require_start(db, spec, payload.start_ms)
    row = BacktestSession(
        user_id=user.id,
        account_id=payload.account_id,
        symbol=spec.symbol,
        timeframe=payload.timeframe,
        start_ms=payload.start_ms,
        end_ms=payload.end_ms,
        cursor_ms=payload.start_ms,
        initial_balance=payload.initial_balance,
        currency=payload.currency,
        spread_pips=payload.spread_pips,
        commission_per_lot=payload.commission_per_lot,
        status="active",
        warnings=[],
    )
    db.add(row)
    record_session_created(db, user)
    db.commit()
    db.refresh(row)
    return _detail(db, row)


def list_sessions(db: Session, user: User) -> list[SessionSummary]:
    rows = db.scalars(select(BacktestSession).where(BacktestSession.user_id == user.id).order_by(BacktestSession.updated_at.desc())).all()
    return [_summary(db, row) for row in rows]


def get_session(db: Session, user: User, session_id: uuid.UUID) -> SessionDetail:
    return _detail(db, _session(db, user, session_id))


def save_state(db: Session, user: User, session_id: uuid.UUID, payload: SessionStateIn) -> SessionDetail:
    row = _session(db, user, session_id)
    if row.status != "active":
        raise BacktestError("invalid_request", "This session is already finished.")
    if payload.cursor_ms < row.start_ms or (row.end_ms is not None and payload.cursor_ms > row.end_ms):
        raise BacktestError("invalid_request", "The cursor is outside the session window.")
    row.cursor_ms = payload.cursor_ms
    if payload.notes is not None:
        row.notes = payload.notes
    db.commit()
    return _detail(db, row)


def save_orders(db: Session, user: User, session_id: uuid.UUID, payload: OrderBatch) -> list[OrderOut]:
    row = _session(db, user, session_id)
    stored: list[SessionOrder] = []
    for item in payload.orders:
        existing = db.get(SessionOrder, item.id)
        if existing is not None:
            if existing.session_id != row.id or existing.user_id != user.id:
                raise not_found("Order")
            stored.append(existing)
            continue
        _in_window(row, item.created_ms)
        order = SessionOrder(
            id=item.id,
            session_id=row.id,
            user_id=user.id,
            side=item.side,
            order_type=item.order_type,
            size=item.size,
            price=item.price,
            sl=item.sl,
            tp=item.tp,
            status=item.status,
            created_ms=item.created_ms,
            filled_ms=item.filled_ms,
        )
        db.add(order)
        stored.append(order)
    db.commit()
    return [_order_out(order) for order in stored]


def save_trades(
    db: Session,
    user: User,
    session_id: uuid.UUID,
    payload: TradeBatch,
    *,
    bars: BarLookup | None = None,
) -> list[TradeOut]:
    row = _session(db, user, session_id)
    spec = enabled_instrument(row.symbol)
    lookup = bars or default_bars(spec)
    stored: list[SessionTrade] = []
    for item in payload.trades:
        existing = db.get(SessionTrade, item.id)
        if existing is not None:
            if existing.session_id != row.id or existing.user_id != user.id:
                raise not_found("Trade")
            stored.append(existing)
            continue
        _in_window(row, item.entry_ms)
        _in_window(row, item.exit_ms)
        _inside_candle(spec, lookup, item.entry_ms, item.entry_price)
        _inside_candle(spec, lookup, item.exit_ms, item.exit_price)
        valued = _recompute(row, spec, item)
        trade = SessionTrade(
            id=item.id,
            session_id=row.id,
            user_id=user.id,
            side=item.side,
            size=item.size,
            entry_ms=item.entry_ms,
            entry_price=item.entry_price,
            exit_ms=item.exit_ms,
            exit_price=item.exit_price,
            sl=item.sl,
            tp=item.tp,
            exit_reason=item.exit_reason,
            commission=valued[3],
            pnl=valued[2],
            pips=valued[0],
            r_multiple=valued[1],
            pnl_currency=valued[4],
            client_pnl=item.client_pnl,
            discrepancy=item.client_pnl is not None and abs(item.client_pnl - valued[2]) > MONEY_TOLERANCE,
            notes=item.notes,
        )
        if trade.discrepancy:
            _warn(row, f"trade {item.id} pnl was recomputed")
        for warning in valued[5]:
            _warn(row, warning)
        db.add(trade)
        stored.append(trade)
    db.commit()
    return [_trade_out(trade) for trade in stored]


def finish_session(db: Session, user: User, session_id: uuid.UUID) -> SessionDetail:
    row = _session(db, user, session_id)
    if row.status != "finished":
        row.status = "finished"
        db.commit()
    return _detail(db, row)


def delete_session(db: Session, user: User, session_id: uuid.UUID) -> None:
    row = _session(db, user, session_id)
    db.delete(row)
    db.commit()


def replay_for_trade(db: Session, user: User, session_id: uuid.UUID, trade_id: uuid.UUID) -> ReplayPayload:
    row = _session(db, user, session_id)
    trade = db.get(SessionTrade, trade_id)
    if trade is None or trade.session_id != row.id:
        raise not_found("Trade")
    side = "long" if trade.side == "buy" else "short"
    descriptor = ReplayTradeDescriptor(
        source="session",
        trade_ref=str(trade.id),
        user_id=user.id,
        broker=None,
        raw_symbol=row.symbol,
        side=side,
        size=_num(trade.size),
        entry_ms=trade.entry_ms,
        entry_price=_num(trade.entry_price),
        exit_ms=trade.exit_ms,
        exit_price=_num(trade.exit_price),
        stop_loss=_num(trade.sl) if trade.sl is not None else None,
        take_profit=_num(trade.tp) if trade.tp is not None else None,
        fees=_num(trade.commission),
        time_basis="utc_aware",
        time_rule="utc_aware",
    )
    return build_replay_payload(db, descriptor)


def save_to_journal(db: Session, user: User, session_id: uuid.UUID, trade_id: uuid.UUID, account_id: uuid.UUID) -> JournalSaveOut:
    row = _session(db, user, session_id)
    trade = db.get(SessionTrade, trade_id)
    if trade is None or trade.session_id != row.id:
        raise not_found("Trade")
    from app.models.account import Account

    account = db.get(Account, account_id)
    if account is None or account.user_id != user.id:
        raise not_found("Account")
    spec = enabled_instrument(row.symbol)
    asset = {"forex": AssetType.forex, "crypto": AssetType.crypto}.get(spec.asset_class, AssetType.future)
    journal = Trade(
        user_id=user.id,
        account_id=account.id,
        symbol=row.symbol,
        asset_type=asset,
        side=TradeSide.long if trade.side == "buy" else TradeSide.short,
        quantity=trade.size,
        entry_price=trade.entry_price,
        exit_price=trade.exit_price,
        opened_at=datetime.fromtimestamp(trade.entry_ms / 1000, timezone.utc),
        closed_at=datetime.fromtimestamp(trade.exit_ms / 1000, timezone.utc),
        pnl=trade.pnl,
        fees=trade.commission,
        status=TradeStatus.closed,
        is_simulated=True,
        time_basis="utc_aware",
        notes=trade.notes,
    )
    db.add(journal)
    db.commit()
    db.refresh(journal)
    return JournalSaveOut(trade_id=journal.id)


def _recompute(row: BacktestSession, spec: InstrumentSpec, item) -> tuple[float, float | None, float, float, str, list[str]]:
    rule = RuleInstrument(spec.symbol, spec.asset_class, spec.pip_size, spec.contract_size, spec.quote_currency, spec.price_decimals)
    return value_closed_trade(
        rule,
        Costs(_num(row.spread_pips), _num(row.commission_per_lot), 0),
        side=item.side,
        size=item.size,
        entry_price=item.entry_price,
        exit_price=item.exit_price,
        sl=item.sl,
        account_currency=row.currency,
    )


def _in_window(row: BacktestSession, time_ms: int) -> None:
    if time_ms < row.start_ms or (row.end_ms is not None and time_ms > row.end_ms):
        raise BacktestError("invalid_request", "A trade time is outside the session window.")


def _inside_candle(spec: InstrumentSpec, lookup: BarLookup, time_ms: int, price: float) -> None:
    span = lookup(time_ms)
    if span is None:
        raise BacktestError("data_unavailable", "No candle covers that trade time.")
    low, high = span
    tol = tolerance(spec, price)
    if price < low - tol or price > high + tol:
        raise BacktestError("invalid_request", "A trade price is outside the candle at that time.")


def _warn(row: BacktestSession, warning: str) -> None:
    current = list(row.warnings or [])
    if warning not in current:
        current.append(warning)
        row.warnings = current


def _trades(db: Session, session_id: uuid.UUID) -> list[SessionTrade]:
    return list(db.scalars(select(SessionTrade).where(SessionTrade.session_id == session_id).order_by(SessionTrade.entry_ms)).all())


def _orders(db: Session, session_id: uuid.UUID) -> list[SessionOrder]:
    return list(db.scalars(select(SessionOrder).where(SessionOrder.session_id == session_id).order_by(SessionOrder.created_ms)).all())


def _stats(row: BacktestSession, trades: list[SessionTrade]) -> SessionStats:
    pnls = [_num(trade.pnl) for trade in trades]
    rs = [_num(trade.r_multiple) for trade in trades if trade.r_multiple is not None]
    wins = sum(1 for value in pnls if value > 0)
    net = sum(pnls)
    return SessionStats(
        net_profit=net,
        trade_count=len(trades),
        wins=wins,
        win_rate=(wins / len(trades)) if trades else 0,
        expectancy_r=(sum(rs) / len(rs)) if rs else None,
        balance=_num(row.initial_balance) + net,
    )


def _summary(db: Session, row: BacktestSession) -> SessionSummary:
    stats = _stats(row, _trades(db, row.id))
    return SessionSummary(
        id=row.id,
        symbol=row.symbol,
        timeframe=row.timeframe,
        status=row.status,
        start_ms=row.start_ms,
        end_ms=row.end_ms,
        cursor_ms=row.cursor_ms,
        initial_balance=_num(row.initial_balance),
        balance=stats.balance,
        currency=row.currency,
        trade_count=stats.trade_count,
        net_profit=stats.net_profit,
        updated_at=row.updated_at,
    )


def _detail(db: Session, row: BacktestSession) -> SessionDetail:
    trades = _trades(db, row.id)
    summary = _summary(db, row)
    return SessionDetail(
        **summary.model_dump(),
        spread_pips=_num(row.spread_pips),
        commission_per_lot=_num(row.commission_per_lot),
        notes=row.notes,
        warnings=list(row.warnings or []),
        orders=[_order_out(order) for order in _orders(db, row.id)],
        trades=[_trade_out(trade) for trade in trades],
        stats=_stats(row, trades),
    )


def _order_out(order: SessionOrder) -> OrderOut:
    return OrderOut(
        id=order.id,
        side=order.side,
        order_type=order.order_type,
        size=_num(order.size),
        price=_num(order.price) if order.price is not None else None,
        sl=_num(order.sl) if order.sl is not None else None,
        tp=_num(order.tp) if order.tp is not None else None,
        status=order.status,
        created_ms=order.created_ms,
        filled_ms=order.filled_ms,
    )


def _trade_out(trade: SessionTrade) -> TradeOut:
    return TradeOut(
        id=trade.id,
        side=trade.side,
        size=_num(trade.size),
        entry_ms=trade.entry_ms,
        entry_price=_num(trade.entry_price),
        exit_ms=trade.exit_ms,
        exit_price=_num(trade.exit_price),
        sl=_num(trade.sl) if trade.sl is not None else None,
        tp=_num(trade.tp) if trade.tp is not None else None,
        exit_reason=trade.exit_reason,
        commission=_num(trade.commission),
        pnl=_num(trade.pnl),
        pips=_num(trade.pips),
        r_multiple=_num(trade.r_multiple) if trade.r_multiple is not None else None,
        pnl_currency=trade.pnl_currency,
        discrepancy=trade.discrepancy,
        notes=trade.notes,
    )
