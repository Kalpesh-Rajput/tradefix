import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.services.health import worker_status
from app.schemas.market_data import CandlesOut, DataJobOut, InstrumentOut
from app.schemas.replay import SymbolInterestIn, SymbolInterestOut
from app.services.backtest.entitlements import require_feature
from app.services.marketdata import read_api

router = APIRouter(prefix="/api/market-data", tags=["market-data"])


@router.get("/worker")
def market_worker_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return worker_status(db, admin=user.role == "admin")


@router.get("/instruments", response_model=list[InstrumentOut])
def list_instruments(
    q: str | None = Query(None, max_length=32),
    asset_class: str | None = Query(None, pattern="^(forex|metal|index|crypto)$"),
    _user: User = Depends(require_feature("market_data.read")),
):
    return read_api.list_instruments(q, asset_class)


@router.get("/candles", response_model=CandlesOut)
def get_candles(
    symbol: str = Query(..., min_length=3, max_length=32),
    timeframe: str = Query("1m", max_length=4),
    start: str = Query(..., max_length=40),
    end: str = Query(..., max_length=40),
    until: str | None = Query(None, max_length=40),
    limit: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("market_data.read")),
):
    return read_api.candles_for_user(
        db, current_user, symbol=symbol.upper(), timeframe=timeframe, start=start, end=end, until=until, limit=limit
    )


@router.post("/symbol-interest", response_model=SymbolInterestOut, status_code=status.HTTP_202_ACCEPTED)
def symbol_interest(
    payload: SymbolInterestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("market_data.read")),
):
    read_api.record_symbol_interest(db, current_user, payload.broker, payload.raw_symbol)
    return SymbolInterestOut(recorded=True)


@router.get("/jobs/{job_id}", response_model=DataJobOut)
def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("market_data.read")),
):
    return read_api.job_for_user(db, current_user, job_id)
