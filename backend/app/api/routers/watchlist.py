import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.models.watchlist import WatchlistItem
from app.schemas.watchlist import WatchlistItemCreate, WatchlistItemResponse

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("", response_model=list[WatchlistItemResponse])
def list_watchlist(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(WatchlistItem).where(WatchlistItem.user_id == current_user.id).order_by(WatchlistItem.created_at.desc())
    return db.scalars(stmt).all()


@router.post("", response_model=WatchlistItemResponse, status_code=status.HTTP_201_CREATED)
def add_watchlist_item(
    payload: WatchlistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = WatchlistItem(user_id=current_user.id, symbol=payload.symbol.upper(), notes=payload.notes)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_watchlist_item(item_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.get(WatchlistItem, item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist item not found")
    db.delete(item)
    db.commit()
    return None
