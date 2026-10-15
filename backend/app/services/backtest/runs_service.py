"""Queue automated runs, execute them, and serve their replay descriptors."""

from __future__ import annotations

import copy
import hashlib
import logging
import json
import time
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, insert, literal, select
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.backtest import BacktestRun, BacktestRunTrade
from app.models.market_data import CandleCoverage, CandleMonthStat
from app.models.user import User
from app.services.backtest.bar_loader import LoadedBars, load_strategy_bars, required_warmup
from app.services.backtest.downsample import downsample_minmax
from app.services.backtest.engine import run_strategy
from app.services.backtest.errors import BacktestError, not_found
from app.services.backtest.metrics import summarize_trades, warnings_for
from app.services.backtest.quotas import assert_run_quota, record_run_created
from app.services.backtest.rules import Bar, InstrumentSpec
from app.services.backtest.strategy_schema import StrategyDefinition, parse_strategy
from app.services.backtest.strategies_service import estimated_bars, get_strategy, validate_definition
from app.services.jobs import queue
from app.services.marketdata.aggregation import timeframe_ms
from app.services.marketdata.coverage import find_gaps
from app.services.marketdata.ingest_jobs import enqueue_ingest
from app.services.marketdata.read_api import enabled_instrument
from app.services.marketdata.replay_service import ReplayTradeDescriptor, build_replay_payload

ACTIVE_RUN = ("queued", "running", "waiting_data")

logger = logging.getLogger("tradefix.backtest")

JOB_TYPE = "backtest.run"


def load_bars(db: Session, symbol: str, timeframe: str, start_ms: int, end_ms: int, *, warmup_bars: int = 0) -> LoadedBars:
    """Stored candles for the run, plus the warm-up bars before the requested range."""
    spec = enabled_instrument(symbol)
    return load_strategy_bars(db, spec, timeframe, start_ms, end_ms, warmup_bars=warmup_bars)


def coverage_version(db: Session, symbol: str, source: str, start_ms: int, end_ms: int) -> str:
    """Hash of the coverage rows and month stats overlapping the range. This is the data version in the result hash."""
    ranges = db.scalars(
        select(CandleCoverage)
        .where(
            CandleCoverage.instrument == symbol,
            CandleCoverage.source == source,
            CandleCoverage.covered_to > start_ms,
            CandleCoverage.covered_from < end_ms,
        )
        .order_by(CandleCoverage.covered_from)
    ).all()
    months = [
        row
        for row in db.scalars(
            select(CandleMonthStat)
            .where(CandleMonthStat.instrument == symbol, CandleMonthStat.source == source)
            .order_by(CandleMonthStat.year, CandleMonthStat.month)
        ).all()
        if _month_overlaps(row.year, row.month, start_ms, end_ms)
    ]
    payload = {
        "ranges": [
            {"from": row.covered_from, "to": row.covered_to, "rows": int(row.row_count), "updated": _iso(row.updated_at)}
            for row in ranges
        ],
        "months": [
            {"year": row.year, "month": row.month, "rows": row.row_count, "updated": _iso(row.updated_at)} for row in months
        ],
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _month_overlaps(year: int, month: int, start_ms: int, end_ms: int) -> bool:
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    nxt = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month == 12 else datetime(year, month + 1, 1, tzinfo=timezone.utc)
    return int(nxt.timestamp() * 1000) > start_ms and int(start.timestamp() * 1000) < end_ms


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def result_hash(definition: dict, symbol: str, timeframe: str, start_ms: int, end_ms: int, coverage: str = "") -> str:
    payload = json.dumps(
        {
            "definition": definition,
            "symbol": symbol,
            "timeframe": timeframe,
            "start_ms": start_ms,
            "end_ms": end_ms,
            "coverage_version": coverage,
        },
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
        select(func.count()).select_from(BacktestRun).where(BacktestRun.user_id == user.id, BacktestRun.status.in_(ACTIVE_RUN))
    ) or 0
    assert_run_quota(db, user, running=running)
    spec = enabled_instrument(definition.market.symbol.upper())
    warmup = required_warmup(definition)
    window_start = max(0, definition.market.start_ms - warmup * timeframe_ms(definition.market.timeframe))
    version = coverage_version(db, spec.symbol, spec.source, window_start, definition.market.end_ms)
    digest = result_hash(
        definition.model_dump(),
        definition.market.symbol,
        definition.market.timeframe,
        definition.market.start_ms,
        definition.market.end_ms,
        version,
    )
    if not payload.get("force_fresh"):
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
        _fail(ctx, "limit_exceeded", "That range is too long for one run.")
    await_market_data(ctx, run, definition)
    deadline = time.monotonic() + settings.backtest_time_limit_s
    ctx.progress(20, "indicators")
    _check_time(ctx, deadline)
    spec = enabled_instrument(run.symbol)
    warmup = required_warmup(definition)
    loaded = load_bars(ctx.db, run.symbol, run.timeframe, run.start_ms, run.end_ms, warmup_bars=warmup)
    bars, trade_start, first_ms, last_ms = _loaded_parts(loaded)
    needed = warmup + settings.backtest_min_bars
    if len(bars) < needed:
        start = datetime.fromtimestamp(run.start_ms / 1000, timezone.utc).date().isoformat()
        end = datetime.fromtimestamp(run.end_ms / 1000, timezone.utc).date().isoformat()
        _fail(
            ctx,
            "insufficient_data",
            f"{run.symbol} {run.timeframe} from {start} to {end} has {len(bars)} bars; "
            f"this run needs at least {needed} ({warmup} warm-up plus {settings.backtest_min_bars}).",
        )
    instrument = InstrumentSpec(spec.symbol, spec.asset_class, spec.pip_size, spec.contract_size, spec.quote_currency, spec.price_decimals)
    ctx.progress(60, "simulation")
    engine = run_strategy(definition, bars, instrument, trade_start_index=trade_start)
    _check_time(ctx, deadline)
    version = coverage_version(ctx.db, spec.symbol, spec.source, _window_start(run, warmup), run.end_ms)
    run.coverage_version = version
    run.result_hash = result_hash(definition.model_dump(), run.symbol, run.timeframe, run.start_ms, run.end_ms, version)
    run.warmup_bars = warmup
    run.first_bar_ms = first_ms
    run.last_bar_ms = last_ms
    _persist(ctx.db, run, engine, definition, len(bars) - trade_start)
    ctx.progress(100, "done")
    ctx.db.commit()
    logger.info("backtest finished", extra={"job_id": str(ctx.job.id), "run_id": str(run.id), "status": "succeeded", "job_type": JOB_TYPE})
    return {"status": "succeeded", "run_id": str(run.id)}


def _loaded_parts(loaded: LoadedBars | list[Bar]) -> tuple[list[Bar], int, int | None, int | None]:
    if isinstance(loaded, list):
        first = loaded[0].time if loaded else None
        last = loaded[-1].time if loaded else None
        return loaded, 0, first, last
    return loaded.bars, loaded.trade_start_index, loaded.first_bar_ms, loaded.last_bar_ms


def _window_start(run: BacktestRun, warmup: int) -> int:
    step = timeframe_ms(run.timeframe)
    return max(0, run.start_ms - warmup * step)


def await_market_data(ctx: queue.JobContext, run: BacktestRun, definition: StrategyDefinition) -> None:
    """Enqueue a deduplicated ingest when the 1-minute range is missing, and wait without holding a worker slot."""
    spec = enabled_instrument(run.symbol)
    warmup = required_warmup(definition)
    start = _window_start(run, warmup)
    gaps = find_gaps(ctx.db, spec.symbol, spec.source, start, run.end_ms)
    if not gaps:
        run.status = "running"
        return
    now = queue.utcnow()
    if run.waiting_since is not None:
        waited = (now - run.waiting_since).total_seconds()
        if waited >= settings.backtest_data_wait_max_s:
            _fail(ctx, "data_unavailable", _unavailable(run, "the wait limit passed before the candles were stored"))
        if run.data_job_id is not None:
            from app.models.job import Job

            data_job = ctx.db.get(Job, run.data_job_id)
            if data_job is not None and data_job.status in ("failed", "cancelled"):
                detail = data_job.error_message or data_job.status
                _fail(ctx, "data_unavailable", _unavailable(run, detail))
    else:
        enqueued = enqueue_ingest(ctx.db, spec, gaps[0][0], gaps[-1][1], owner_user_id=run.user_id)
        run.data_job_id = enqueued.job.id
        run.waiting_since = now
    run.status = "waiting_data"
    ctx.db.commit()
    raise queue.JobDeferred(settings.backtest_data_poll_s)


def _unavailable(run: BacktestRun, reason: str) -> str:
    start = datetime.fromtimestamp(run.start_ms / 1000, timezone.utc).date().isoformat()
    end = datetime.fromtimestamp(run.end_ms / 1000, timezone.utc).date().isoformat()
    return f"Market data for {run.symbol} {run.timeframe} from {start} to {end} is unavailable: {reason}."


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


def _fail(ctx: queue.JobContext, code: str, message: str) -> None:
    _finish(ctx, "failed", code, message)
    raise _stopped(code, message)


def _finish(ctx: queue.JobContext, status: str, code: str | None, message: str | None) -> None:
    ctx.db.rollback()
    run = ctx.db.get(BacktestRun, uuid.UUID(ctx.payload["run_id"]))
    if run is None or run.status in ("succeeded", "failed", "cancelled"):
        return
    run.status = status
    run.error_code = code
    run.error_message = message
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
        metrics=copy.deepcopy(cached.metrics),
        equity=copy.deepcopy(cached.equity),
        warnings=list(cached.warnings or []),
        skip_counts=dict(cached.skip_counts or {}),
        bars_processed=cached.bars_processed,
        first_bar_ms=cached.first_bar_ms,
        last_bar_ms=cached.last_bar_ms,
        warmup_bars=cached.warmup_bars,
        coverage_version=cached.coverage_version,
        served_from_cache=True,
        cached_from_run_id=cached.id,
        finished_at=queue.utcnow(),
    )
    db.add(run)
    db.flush()
    _copy_trade_rows(db, cached.id, run.id)
    record_run_created(db, user)
    db.commit()
    db.refresh(run)
    return run


def _copy_trade_rows(db: Session, source_id: uuid.UUID, dest_id: uuid.UUID) -> None:
    """Copy stored trades with INSERT ... SELECT. The cap matches how many trades a run is allowed to keep."""
    src = BacktestRunTrade
    query = (
        select(
            func.gen_random_uuid(),
            literal(dest_id, type_=PG_UUID(as_uuid=True)),
            src.user_id,
            src.seq,
            src.side,
            src.size,
            src.entry_ms,
            src.entry_price,
            src.exit_ms,
            src.exit_price,
            src.sl,
            src.tp,
            src.exit_reason,
            src.pnl,
            src.pips,
            src.r_multiple,
            src.bars_held,
            src.mae_pips,
            src.mfe_pips,
        )
        .where(src.run_id == source_id)
        .order_by(src.seq)
        .limit(settings.backtest_max_trades_per_run)
    )
    db.execute(
        insert(BacktestRunTrade).from_select(
            [
                "id", "run_id", "user_id", "seq", "side", "size",
                "entry_ms", "entry_price", "exit_ms", "exit_price", "sl", "tp",
                "exit_reason", "pnl", "pips", "r_multiple", "bars_held", "mae_pips", "mfe_pips",
            ],
            query,
        )
    )


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
        trades.append({"pnl": trade.pnl, "r": trade.r_multiple, "bars_held": 0, "entry_ms": trade.entry_time, "exit_ms": trade.exit_time})
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
