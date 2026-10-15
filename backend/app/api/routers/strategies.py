import uuid

from fastapi import APIRouter, Body, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.strategy import StrategyOut, ValidateOut
from app.services.backtest import strategies_service
from app.services.backtest.entitlements import require_feature

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


def _out(row) -> StrategyOut:
    return StrategyOut(
        id=row.id,
        name=row.name,
        description=row.description,
        schema_version=row.schema_version,
        definition=row.definition,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.post("/validate", response_model=ValidateOut)
def validate(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return strategies_service.validate_definition(db, payload)


@router.post("", response_model=StrategyOut, status_code=status.HTTP_201_CREATED)
def create(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return _out(strategies_service.create_strategy(db, user, payload))


@router.get("", response_model=list[StrategyOut])
def list_strategies(db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return [_out(row) for row in strategies_service.list_strategies(db, user)]


@router.get("/{strategy_id}", response_model=StrategyOut)
def get_strategy(strategy_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return _out(strategies_service.get_strategy(db, user, strategy_id))


@router.put("/{strategy_id}", response_model=StrategyOut)
def update(strategy_id: uuid.UUID, payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    return _out(strategies_service.update_strategy(db, user, strategy_id, payload))


@router.delete("/{strategy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(strategy_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.automated"))):
    strategies_service.delete_strategy(db, user, strategy_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
