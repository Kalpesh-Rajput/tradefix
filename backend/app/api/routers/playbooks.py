from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.playbook import (
    PlaybookCreate,
    PlaybookFromTemplate,
    PlaybookResponse,
    PlaybookTemplateResponse,
    PlaybookUpdate,
)
from app.services import playbooks_service as svc

router = APIRouter(prefix="/api/playbooks", tags=["playbooks"])
templates_router = APIRouter(prefix="/api/playbook-templates", tags=["playbook-templates"])


@templates_router.get("", response_model=list[PlaybookTemplateResponse])
def list_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = svc.list_templates(db)
    db.commit()
    return rows


@templates_router.get("/{slug}", response_model=PlaybookTemplateResponse)
def get_template(slug: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = svc.get_template_by_slug(db, slug)
    db.commit()
    if not row or row.status != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return row


@router.get("", response_model=list[PlaybookResponse])
def list_playbooks(
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.list_playbooks(db, current_user.id, include_archived=include_archived)


@router.post("", response_model=PlaybookResponse, status_code=status.HTTP_201_CREATED)
def create_playbook(
    payload: PlaybookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = svc.create_playbook(db, current_user.id, payload)
    db.commit()
    db.refresh(row)
    return row


@router.post("/from-template", response_model=PlaybookResponse, status_code=status.HTTP_201_CREATED)
def create_from_template(
    payload: PlaybookFromTemplate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = svc.clone_from_template(db, current_user.id, payload.slug)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{playbook_id}", response_model=PlaybookResponse)
def get_playbook(
    playbook_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.get_playbook(db, current_user.id, playbook_id)


@router.patch("/{playbook_id}", response_model=PlaybookResponse)
def update_playbook(
    playbook_id: uuid.UUID,
    payload: PlaybookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = svc.update_playbook(db, current_user.id, playbook_id, payload)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{playbook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playbook(
    playbook_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc.archive_playbook(db, current_user.id, playbook_id)
    db.commit()
