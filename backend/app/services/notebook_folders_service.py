import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.notebook_folder import NotebookFolder
from app.models.user import User
from app.schemas.notebook_folder import NotebookFolderCreate, NotebookFolderUpdate

logger = logging.getLogger(__name__)


def _owned_account(db: Session, user: User, account_id: uuid.UUID) -> Account:
    account = db.get(Account, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def list_folders(db: Session, user: User, account_id: uuid.UUID) -> list[NotebookFolder]:
    _owned_account(db, user, account_id)
    return list(
        db.scalars(
            select(NotebookFolder)
            .where(NotebookFolder.user_id == user.id, NotebookFolder.account_id == account_id)
            .order_by(NotebookFolder.sort_order.asc(), NotebookFolder.created_at.asc())
        ).all()
    )


def get_folder(db: Session, user: User, folder_id: uuid.UUID) -> NotebookFolder:
    folder = db.get(NotebookFolder, folder_id)
    if not folder or folder.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return folder


def create_folder(db: Session, user: User, payload: NotebookFolderCreate) -> NotebookFolder:
    _owned_account(db, user, payload.account_id)
    max_order = db.scalar(
        select(func.coalesce(func.max(NotebookFolder.sort_order), -1)).where(
            NotebookFolder.user_id == user.id,
            NotebookFolder.account_id == payload.account_id,
        )
    )
    folder = NotebookFolder(
        user_id=user.id,
        account_id=payload.account_id,
        name=payload.name,
        sort_order=int(max_order or -1) + 1,
    )
    db.add(folder)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A folder with that name already exists")
    db.refresh(folder)
    logger.info("Created notebook folder %s", folder.id)
    return folder


def update_folder(db: Session, user: User, folder_id: uuid.UUID, payload: NotebookFolderUpdate) -> NotebookFolder:
    folder = get_folder(db, user, folder_id)
    if payload.name is not None:
        folder.name = payload.name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A folder with that name already exists")
    db.refresh(folder)
    return folder


def delete_folder(db: Session, user: User, folder_id: uuid.UUID) -> None:
    folder = get_folder(db, user, folder_id)
    db.delete(folder)
    db.commit()
    logger.info("Deleted notebook folder %s", folder_id)
