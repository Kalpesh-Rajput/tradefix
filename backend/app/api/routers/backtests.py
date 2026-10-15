import uuid

from fastapi import APIRouter, Body, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.replay import ReplayPayload
from app.services.backtest import runs_service
from app.services.backtest.entitlements import require_feature

router = APIRouter(prefix="/api/backtests", tags=["backtests"])


def _out(row) -> dict:
    return {
        "id": str(row.id),
        "symbol": row.symbol,
        "timeframe": row.timeframe,
        "status": row.status,
        "start_ms": row.start_ms,
        "end_ms": row.end_ms,
        "metrics": row.metrics,
        "equity": row.equity,
        "warnings": row.warnings,
        "error_message": row.error_message,
        "bars_processed": row.bars_processed,
        "job_id": str(row.job_id) if row.job_id else None,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def start(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return _out(runs_service.start_run(db, user, payload))


@router.get("")
def list_runs(db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return [_out(row) for row in runs_service.list_runs(db, user)]


@router.get("/{run_id}")
def get_run(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return _out(runs_service.get_run(db, user, run_id))


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
            }
            for row in rows
        ],
    }


@router.post("/{run_id}/cancel")
def cancel(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return _out(runs_service.cancel_run(db, user, run_id))


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    runs_service.delete_run(db, user, run_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{run_id}/trades/{seq}/replay", response_model=ReplayPayload)
def replay(run_id: uuid.UUID, seq: int, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return runs_service.replay_for_seq(db, user, run_id, seq)
