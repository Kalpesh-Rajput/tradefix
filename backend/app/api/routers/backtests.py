import uuid

from fastapi import APIRouter, Body, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.job import Job
from app.models.user import User
from app.schemas.replay import ReplayPayload
from app.services.backtest import runs_service
from app.services.backtest.entitlements import require_feature

router = APIRouter(prefix="/api/backtests", tags=["backtests"])


def _out(db: Session, row) -> dict:
    job = db.get(Job, row.job_id) if row.job_id else None
    definition = row.definition or {}
    return {
        "id": str(row.id),
        "name": definition.get("name") or row.symbol,
        "strategy_id": str(row.strategy_id) if row.strategy_id else None,
        "symbol": row.symbol,
        "timeframe": row.timeframe,
        "status": row.status,
        "start_ms": row.start_ms,
        "end_ms": row.end_ms,
        "metrics": row.metrics,
        "equity": row.equity,
        "warnings": row.warnings,
        "error_code": row.error_code,
        "error_message": row.error_message,
        "bars_processed": row.bars_processed,
        "job_id": str(row.job_id) if row.job_id else None,
        "progress": _progress(row, job, data_job := _job(db, row.data_job_id)),
        "progress_message": _message(row, job, data_job),
        "first_bar_ms": row.first_bar_ms,
        "last_bar_ms": row.last_bar_ms,
        "warmup_bars": row.warmup_bars,
        "coverage_version": row.coverage_version,
        "served_from_cache": bool(row.served_from_cache),
        "data_job": _data_job(data_job),
    }


def _job(db: Session, job_id):
    return db.get(Job, job_id) if job_id else None


def _data_job(job: Job | None) -> dict | None:
    if job is None:
        return None
    return {
        "id": str(job.id),
        "status": job.status,
        "progress": job.progress,
        "progress_message": job.progress_message,
        "error_message": job.error_message,
    }


def _progress(row, job: Job | None, data_job: Job | None) -> int:
    if row.status == "waiting_data" and data_job is not None:
        return data_job.progress
    if job is not None:
        return job.progress
    return 100 if row.status == "succeeded" else 0


def _message(row, job: Job | None, data_job: Job | None) -> str | None:
    if row.status == "waiting_data":
        return (data_job.progress_message if data_job is not None else None) or "Waiting for market data"
    if job is not None:
        return job.progress_message
    return row.status


@router.post("", status_code=status.HTTP_201_CREATED)
def start(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return _out(db, runs_service.start_run(db, user, payload))


@router.get("")
def list_runs(db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return [_out(db, row) for row in runs_service.list_runs(db, user)]


@router.get("/{run_id}")
def get_run(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return _out(db, runs_service.get_run(db, user, run_id))


@router.get("/{run_id}/trades")
def trades(
    run_id: uuid.UUID,
    side: str | None = None,
    exit_reason: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(require_feature("backtesting.automated")),
):
    rows, total = runs_service.run_trades(db, user, run_id, side=side, exit_reason=exit_reason, limit=limit, offset=offset)
    return {
        "total": total,
        "trades": [
            {
                "seq": row.seq,
                "side": row.side,
                "size": float(row.size),
                "entry_ms": row.entry_ms,
                "entry_price": float(row.entry_price),
                "exit_ms": row.exit_ms,
                "exit_price": float(row.exit_price),
                "pnl": float(row.pnl),
                "pips": float(row.pips),
                "r_multiple": float(row.r_multiple) if row.r_multiple is not None else None,
                "exit_reason": row.exit_reason,
                "bars_held": row.bars_held,
            }
            for row in rows
        ],
    }


@router.post("/{run_id}/cancel")
def cancel(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return _out(db, runs_service.cancel_run(db, user, run_id))


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    runs_service.delete_run(db, user, run_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{run_id}/trades/{seq}/replay", response_model=ReplayPayload)
def replay(run_id: uuid.UUID, seq: int, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return runs_service.replay_for_seq(db, user, run_id, seq)
