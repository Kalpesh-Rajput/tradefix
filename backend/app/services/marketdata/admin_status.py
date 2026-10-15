"""Admin view of stored coverage, failed jobs, aliases and unresolved symbols."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.market_data import CandleCoverage, CandleMonthStat, CrosscheckResult, Instrument, SymbolAlias
from app.models.user import User
from app.services.jobs import queue
from app.services.marketdata.ingest_jobs import enqueue_ingest
from app.services.marketdata.read_api import enabled_instrument
from app.services.marketdata.resolver import add_alias, unresolved_report


def data_status(db: Session) -> dict:
    instruments = list(db.scalars(select(Instrument).order_by(Instrument.symbol)).all())
    coverage = list(db.scalars(select(CandleCoverage)).all())
    stats = db.execute(
        select(
            CandleMonthStat.instrument,
            func.coalesce(func.sum(CandleMonthStat.gap_minutes), 0),
            func.coalesce(func.sum(CandleMonthStat.outliers), 0),
        ).group_by(CandleMonthStat.instrument)
    ).all()
    gaps = {symbol: (int(gap), int(outliers)) for symbol, gap, outliers in stats}
    by_symbol: dict[str, list[CandleCoverage]] = {}
    for row in coverage:
        by_symbol.setdefault(row.instrument, []).append(row)
    rows = []
    for instrument in instruments:
        ranges = by_symbol.get(instrument.symbol, [])
        gap, outliers = gaps.get(instrument.symbol, (0, 0))
        updated = max((row.updated_at for row in ranges), default=None)
        rows.append(
            {
                "symbol": instrument.symbol,
                "asset_class": instrument.asset_class,
                "source": instrument.source,
                "enabled": instrument.enabled,
                "covered_from": min((row.covered_from for row in ranges), default=None),
                "covered_to": max((row.covered_to for row in ranges), default=None),
                "row_count": sum(row.row_count for row in ranges),
                "gap_minutes": gap,
                "outliers": outliers,
                "updated_at": updated,
            }
        )
    failures = list(db.scalars(select(Job).where(Job.status == "failed").order_by(Job.created_at.desc()).limit(50)).all())
    latest = list(db.scalars(select(CrosscheckResult).order_by(CrosscheckResult.day.desc(), CrosscheckResult.instrument).limit(40)).all())
    differences = [row for row in latest if row.status == "difference"]
    return {
        "instruments": rows,
        "crosschecks": [_crosscheck(row) for row in latest],
        "crosscheck_differences": [_crosscheck(row) for row in differences],
        "failures": [
            {
                "id": str(job.id),
                "type": job.type,
                "error_code": job.error_code,
                "error_message": job.error_message,
                "created_at": job.created_at,
            }
            for job in failures
        ],
    }


def _crosscheck(row: CrosscheckResult) -> dict:
    return {
        "instrument": row.instrument,
        "day": row.day,
        "stored_close": row.stored_close,
        "reference_close": row.reference_close,
        "difference": row.difference,
        "tolerance": row.tolerance,
        "status": row.status,
    }


def enqueue_backfill(db: Session, user: User, symbol: str, start_ms: int, end_ms: int) -> dict:
    spec = enabled_instrument(symbol)
    enqueued = enqueue_ingest(db, spec, start_ms, end_ms, owner_user_id=user.id)
    db.commit()
    return {"job_id": str(enqueued.job.id), "created": enqueued.created}


def retry_job(db: Session, job_id: uuid.UUID) -> Job | None:
    return queue.retry_failed(db, job_id)


def list_aliases(db: Session) -> list[SymbolAlias]:
    return list(db.scalars(select(SymbolAlias).order_by(SymbolAlias.broker, SymbolAlias.raw_symbol)).all())


def create_alias(db: Session, broker: str, raw_symbol: str, canonical: str, created_by: str) -> SymbolAlias:
    row = add_alias(db, broker, raw_symbol, canonical, created_by=created_by)
    db.commit()
    db.refresh(row)
    return row


def delete_alias(db: Session, alias_id: uuid.UUID) -> bool:
    row = db.get(SymbolAlias, alias_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True


def list_unresolved(db: Session, limit: int = 50) -> list[dict]:
    return [
        {
            "id": str(row.id),
            "broker": row.broker,
            "raw_symbol": row.raw_symbol,
            "count": row.count,
            "interest_count": row.interest_count,
            "last_seen": row.last_seen,
        }
        for row in unresolved_report(db, limit=limit)
    ]
