from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routers.trades import _default_account
from app.core.db import get_db
from app.models.user import User
from app.schemas.trade import TradeImportResult
from app.services.csv_import_service import import_trades_from_csv

router = APIRouter(prefix="/api/imports", tags=["imports"])


@router.post("/csv", response_model=TradeImportResult)
async def import_csv(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _default_account(db, current_user)
    file_bytes = await file.read()
    imported, skipped, errors = import_trades_from_csv(db, current_user, account, file_bytes)
    return TradeImportResult(imported=imported, skipped_duplicates=skipped, errors=errors)
