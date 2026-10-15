"""Queue automated runs, execute them, and serve their replay descriptors."""

from __future__ import annotations

import hashlib
import logging
import json
import time
import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.backtest import BacktestRun, BacktestRunTrade
from app.models.user import User
from app.services.backtest.downsample import downsample_minmax
from app.services.backtest.engine import run_strategy
from app.services.backtest.errors import BacktestError, not_found
from app.services.backtest.metrics import summarize_trades, warnings_for
from app.services.backtest.quotas import assert_run_quota, record_run_created
from app.services.backtest.rules import Bar, InstrumentSpec
from app.services.backtest.strategy_schema import StrategyDefinition, parse_strategy
from app.services.backtest.strategies_service import estimated_bars, get_strategy, validate_definition
from app.services.jobs import queue
from app.services.marketdata.read_api import enabled_instrument
from app.services.marketdata.replay_service import ReplayTradeDescriptor, build_replay_payload

logger = logging.getLogger("tradefix.backtest")

JOB_TYPE = "backtest.run"


def load_bars(symbol: str, timeframe: str, start_ms: int, end_ms: int) -> list[Bar]:
    """Default loader returns no candles. The worker and tests replace this with stored data."""
    return []


def result_hash(definition: dict, symbol: str, timeframe: str, start_ms: int, end_ms: int) -> str:
    payload = json.dumps(
        {"definition": definition, "symbol": symbol, "timeframe": timeframe, "start_ms": start_ms, "end_ms": end_ms},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def start_run(db: Session, user: User, payload: dict) -> BacktestRun:
    definition_body = payload.get("definition")
    strategy_id = payload.get("strategy_id")
    if strategy_id and definition_body is None:
        definition_body = get_strategy(db, user, uuid.UUID(str(strategy_id))).definition
    if not isinstance(definition_body, dict):
        raise BacktestError("invalid_request", "Provide a strategy id or a definition.")
    checked = validate_definition(db, definition_body)
    if not checked["ok"]:
        raise BacktestError("invalid_strategy", "The strategy needs changes.", details={"errors": checked["errors"]})
    definition = parse_strategy(definition_body)
    running = db.scalar(
        select(func.count()).select_from(BacktestRun).where(BacktestRun.user_id == user.id, BacktestRun.status.in_(("queued", "running")))
    ) or 0
    assert_run_quota(db, user, running=running)
    digest = result_hash(definition.model_dump(), definition.market.symbol, definition.market.timeframe, definition.market.start_ms, definition.market.end_ms)
    cached = _cached(db, user, digest)
    if cached is not None:
        return _copy_cached(db, user, cached, definition, strategy_id)
    if checked["estimated_bars"] > settings.backtest_max_bars_per_run:
        raise BacktestError("limit_exceeded", "That range is too long for one run.")
    run = BacktestRun(
        user_id=user.id,
        strategy_id=uuid.UUID(str(strategy_id)) if strategy_id else None,
        definition=definition.model_dump(),
        symbol=definition.market.symbol,
        timeframe=definition.market.timeframe,
        start_ms=definition.market.start_ms,
        end_ms=definition.market.end_ms,
        status="queued",
        result_hash=digest,
        warnings=[],
    )
    db.add(run)
    db.flush()
    enqueued = queue.enqueue(
        db,
        type=JOB_TYPE,
        lane="backtest",
        payload={"run_id": str(run.id)},
        dedup_key=f"backtest:{digest}",
        owner_user_id=user.id,
        max_attempts=1,
    )
    run.job_id = enqueued.job.id
    record_run_created(db, user)
    db.commit()
    db.refresh(run)
    return run


def execute(ctx: queue.JobContext) -> dict:
    try:
        return _execute(ctx)
    except queue.JobCancelled:
        _finish(ctx, "cancelled", None, None)
        raise


def _execute(ctx: queue.JobContext) -> dict:
    ctx.progress(5, "loading")
    run = _run_for(ctx)
    definition = parse_strategy(run.definition)
    if estimated_bars(definition) > settings.backtest_max_bars_per_run:
        _finish(ctx, "failed", "limit_exceeded", "That range is too long for one run.")
        raise _stopped("limit_exceeded", "That range is too long for one run.")
    deadline = time.monotonic() + settings.backtest_time_limit_s
    ctx.progress(20, "indicators")
    _check_time(ctx, deadline)
    spec = enabled_instrument(run.symbol)
    instrument = InstrumentSpec(spec.symbol, spec.asset_class, spec.pip_size, spec.contract_size, spec.quote_currency, spec.price_decimals)
    bars = load_bars(run.symbol, run.timeframe, run.start_ms, run.end_ms)
    ctx.progress(60, "simulation")
    engine = run_strategy(definition, bars, instrument)
    _check_time(ctx, deadline)
    _persist(ctx.db, run, engine, definition, len(bars))
    ctx.progress(100, "done")
    ctx.db.commit()
    logger.info("backtest finished", extra={"job_id": str(ctx.job.id), "run_id": str(run.id), "status": "succeeded", "job_type": JOB_TYPE})
    return {"status": "succeeded", "run_id": str(run.id)}


def _run_for(ctx: queue.JobContext) -> BacktestRun:
    run = ctx.db.get(BacktestRun, uuid.UUID(ctx.payload["run_id"]))
    if run is None:
        raise BacktestError("not_found", "Run not found.")
    run.status = "running"
    return run


def _check_time(ctx: queue.JobContext, deadline: float) -> None:
    if time.monotonic() > deadline:
        _finish(ctx, "failed", "job_failed", "The run exceeded the time limit.")
        raise _stopped("job_failed", "The run exceeded the time limit.")
    ctx.check_cancel()


def _stopped(code: str, message: str) -> BacktestError:
    error = BacktestError(code, message)
    error.retryable = False  # type: ignore[attr-defined]
    return error


def _finish(ctx: queue.JobContext, status: str, code: str | None, message: str | None) -> None:
    ctx.db.rollback()
    run = ctx.db.get(BacktestRun, uuid.UUID(ctx.payload["run_id"]))
    if run is None or run.status in ("succeeded", "failed", "cancelled"):
        return
    run.status = status
    run.error_message = message
    run.warnings = [code] if code else list(run.warnings or [])
    run.finished_at = queue.utcnow()
    ctx.db.commit()


def list_runs(db: Session, user: User) -> list[BacktestRun]:
    return list(db.scalars(select(BacktestRun).where(BacktestRun.user_id == user.id).order_by(BacktestRun.created_at.desc())).all())


def get_run(db: Session, user: User, run_id: uuid.UUID) -> BacktestRun:
    row = db.get(BacktestRun, run_id)
    if row is None or row.user_id != user.id:
        raise not_found("Run")
    return row


def run_trades(
    db: Session,
    user: User,
    run_id: uuid.UUID,
    *,
    side: str | None = None,
    exit_reason: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[BacktestRunTrade], int]:
    get_run(db, user, run_id)
    query = select(BacktestRunTrade).where(BacktestRunTrade.run_id == run_id)
    if side:
        query = query.where(BacktestRunTrade.side == side)
    if exit_reason:
        query = query.where(BacktestRunTrade.exit_reason == exit_reason)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = list(db.scalars(query.order_by(BacktestRunTrade.seq).limit(min(limit, 200)).offset(offset)).all())
    return rows, int(total)


def cancel_run(db: Session, user: User, run_id: uuid.UUID) -> BacktestRun:
    row = get_run(db, user, run_id)
    if row.job_id is not None:
        from app.models.job import Job

        job = db.get(Job, row.job_id)
        if job is not None and job.status in ("queued", "running"):
            job.cancel_requested = True
            if job.status == "queued":
                job.status = "cancelled"
                row.status = "cancelled"
    elif row.status == "queued":
        row.status = "cancelled"
    db.commit()
    return row


def delete_run(db: Session, user: User, run_id: uuid.UUID) -> None:
    row = get_run(db, user, run_id)
    db.delete(row)
    db.commit()


def replay_for_seq(db: Session, user: User, run_id: uuid.UUID, seq: int):
    row = get_run(db, user, run_id)
    trade = db.scalar(select(BacktestRunTrade).where(BacktestRunTrade.run_id == row.id, BacktestRunTrade.seq == seq))
    if trade is None:
        raise not_found("Trade")
    descriptor = ReplayTradeDescriptor(
        source="run",
        trade_ref=str(trade.seq),
        user_id=user.id,
        broker=None,
        raw_symbol=row.symbol,
        side="long" if trade.side == "buy" else "short",
        size=float(trade.size),
        entry_ms=trade.entry_ms,
        entry_price=float(trade.entry_price),
        exit_ms=trade.exit_ms,
        exit_price=float(trade.exit_price),
        stop_loss=float(trade.sl) if trade.sl is not None else None,
        take_profit=float(trade.tp) if trade.tp is not None else None,
        fees=None,
        time_basis="utc_aware",
        time_rule="utc_aware",
    )
    return build_replay_payload(db, descriptor)


def _cached(db: Session, user: User, digest: str) -> BacktestRun | None:
    cutoff = queue.utcnow() - timedelta(hours=settings.backtest_cache_window_hours)
    return db.scalar(
        select(BacktestRun)
        .where(
            BacktestRun.user_id == user.id,
            BacktestRun.result_hash == digest,
            BacktestRun.status == "succeeded",
            BacktestRun.finished_at >= cutoff,
        )
        .order_by(BacktestRun.finished_at.desc())
    )


def _copy_cached(db: Session, user: User, cached: BacktestRun, definition: StrategyDefinition, strategy_id) -> BacktestRun:
    run = BacktestRun(
        user_id=user.id,
        strategy_id=uuid.UUID(str(strategy_id)) if strategy_id else cached.strategy_id,
        definition=definition.model_dump(),
        symbol=cached.symbol,
        timeframe=cached.timeframe,
        start_ms=cached.start_ms,
        end_ms=cached.end_ms,
        status="succeeded",
        result_hash=cached.result_hash,
        metrics=cached.metrics,
        equity=cached.equity,
        warnings=list(cached.warnings or []),
        bars_processed=cached.bars_processed,
        finished_at=queue.utcnow(),
    )
    db.add(run)
    record_run_created(db, user)
    db.commit()
    db.refresh(run)
    return run


def _persist(db: Session, run: BacktestRun, engine, definition: StrategyDefinition, bar_count: int) -> None:
    trades = []
    equity_points = [(run.start_ms, definition.risk.initial_balance)]
    balance = definition.risk.initial_balance
    for seq, trade in enumerate(engine.trades, start=1):
        balance += trade.pnl
        equity_points.append((trade.exit_time, balance))
        row = BacktestRunTrade(
            run_id=run.id,
            user_id=run.user_id,
            seq=seq,
            side=trade.side,
            size=trade.size,
            entry_ms=trade.entry_time,
            entry_price=trade.entry_price,
            exit_ms=trade.exit_time,
            exit_price=trade.exit_price,
            sl=trade.sl,
            tp=trade.tp,
            exit_reason=trade.exit_reason,
            pnl=trade.pnl,
            pips=trade.pips,
            r_multiple=trade.r_multiple,
            bars_held=0,
            mae_pips=0,
            mfe_pips=0,
        )
        db.add(row)
        trades.append({"pnl": trade.pnl, "r": trade.r_multiple, "bars_held": 0})
    run.metrics = summarize_trades(trades, initial=definition.risk.initial_balance, equity=equity_points)
    run.equity = [{"t": t, "v": v} for t, v in downsample_minmax(equity_points, settings.backtest_equity_points)]
    run.warnings = warnings_for(
        trades,
        spread_pips=definition.costs.spread_pips,
        slippage_pips=definition.costs.slippage_pips,
        range_ms=run.end_ms - run.start_ms,
    )
    run.bars_processed = bar_count
    run.status = "succeeded"
    run.finished_at = queue.utcnow()


@queue.register_handler(JOB_TYPE)
def _handle(ctx: queue.JobContext) -> dict:
    return execute(ctx)
