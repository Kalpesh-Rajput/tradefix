from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.notebook_folder import NotebookFolderCreate, NotebookFolderResponse, NotebookFolderUpdate
from app.services import notebook_folders_service as service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notebook-folders", tags=["notebook-folders"])


@router.get("", response_model=list[NotebookFolderResponse])
def list_folders(
    account_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_folders(db, current_user, account_id)


@router.post("", response_model=NotebookFolderResponse, status_code=status.HTTP_201_CREATED)
def create_folder(
    payload: NotebookFolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_folder(db, current_user, payload)


@router.patch("/{folder_id}", response_model=NotebookFolderResponse)
def update_folder(
    folder_id: uuid.UUID,
    payload: NotebookFolderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.name is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")
    return service.update_folder(db, current_user, folder_id, payload)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_folder(db, current_user, folder_id)
    return None
