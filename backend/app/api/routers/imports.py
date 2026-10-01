from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routers.trades import _default_account
from app.core.db import SessionLocal, get_db
from app.models.user import User
from app.schemas.trade import TradeImportResult
from app.services.csv_import_service import import_trades_from_csv

router = APIRouter(prefix="/api/imports", tags=["imports"])


def _tag_imported_trades(user_id, trade_ids) -> None:
    from app.services.ai.agents.executor import run_import_tagger

    db = SessionLocal()
    try:
        run_import_tagger(db, user_id, trade_ids)
    finally:
        db.close()


@router.post("/csv", response_model=TradeImportResult)
async def import_csv(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _default_account(db, current_user)
    file_bytes = await file.read()
    imported, skipped, errors, created_ids = import_trades_from_csv(db, current_user, account, file_bytes)
    if created_ids:
        background_tasks.add_task(_tag_imported_trades, current_user.id, created_ids)
    return TradeImportResult(imported=imported, skipped_duplicates=skipped, errors=errors)
