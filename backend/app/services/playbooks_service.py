from __future__ import annotations

import copy
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.playbook import Playbook, PlaybookTemplate
from app.models.trade_master import MasterCategory
from app.schemas.playbook import PlaybookCreate, PlaybookUpdate
from app.services.masters_service import upsert_master
from app.services.playbook_templates import SYSTEM_PLAYBOOK_TEMPLATES


def seed_system_templates(db: Session) -> None:
    existing = {row.slug: row for row in db.scalars(select(PlaybookTemplate)).all()}
    added = False
    for spec in SYSTEM_PLAYBOOK_TEMPLATES:
        if spec["slug"] in existing:
            continue
        db.add(
            PlaybookTemplate(
                id=spec["id"],
                slug=spec["slug"],
                title=spec["title"],
                description=spec["description"],
                icon=spec["icon"],
                categories=spec["categories"],
                tags=spec["tags"],
                creator_name=spec["creator_name"],
                version=spec["version"],
                is_system=True,
                is_featured=spec["is_featured"],
                status="published",
                sort_order=spec["sort_order"],
                rules=spec["rules"],
                checklist=spec["checklist"],
            )
        )
        added = True
    if added:
        db.flush()


def list_templates(db: Session) -> list[PlaybookTemplate]:
    seed_system_templates(db)
    stmt = (
        select(PlaybookTemplate)
        .where(PlaybookTemplate.status == "published")
        .order_by(PlaybookTemplate.sort_order.asc(), PlaybookTemplate.title.asc())
    )
    return list(db.scalars(stmt).all())


def get_template_by_slug(db: Session, slug: str) -> PlaybookTemplate | None:
    seed_system_templates(db)
    return db.scalars(select(PlaybookTemplate).where(PlaybookTemplate.slug == slug)).first()


def list_playbooks(db: Session, user_id: uuid.UUID, *, include_archived: bool = False) -> list[Playbook]:
    stmt = select(Playbook).where(Playbook.user_id == user_id)
    if not include_archived:
        stmt = stmt.where(Playbook.is_archived.is_(False))
    stmt = stmt.order_by(Playbook.created_at.desc())
    return list(db.scalars(stmt).all())


def get_playbook(db: Session, user_id: uuid.UUID, playbook_id: uuid.UUID) -> Playbook:
    row = db.get(Playbook, playbook_id)
    if not row or row.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return row


def _sync_strategy_master(db: Session, user_id: uuid.UUID, name: str) -> None:
    upsert_master(db, user_id, MasterCategory.strategy, name)


def _normalize_checklist(items: list | None) -> list[dict]:
    out: list[dict] = []
    for item in items or []:
        if isinstance(item, str):
            label = item.strip()
            item_id = None
        elif isinstance(item, dict):
            label = str(item.get("label") or "").strip()
            item_id = item.get("id")
        else:
            continue
        if not label:
            continue
        out.append({"id": str(item_id) if item_id else str(uuid.uuid4()), "label": label[:200]})
    return out


def create_playbook(db: Session, user_id: uuid.UUID, payload: PlaybookCreate) -> Playbook:
    row = Playbook(
        user_id=user_id,
        name=payload.name,
        description=payload.description or "",
        icon=payload.icon or "",
        categories=payload.categories or [],
        tags=payload.tags or [],
        rules=payload.rules or {},
        checklist=_normalize_checklist(payload.checklist),
    )
    db.add(row)
    db.flush()
    _sync_strategy_master(db, user_id, row.name)
    return row


def clone_from_template(db: Session, user_id: uuid.UUID, slug: str) -> Playbook:
    template = get_template_by_slug(db, slug)
    if not template or template.status != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    existing = db.scalars(
        select(Playbook).where(
            Playbook.user_id == user_id,
            Playbook.source_template_id == template.id,
            Playbook.is_archived.is_(False),
        )
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Playbook already added")
    row = Playbook(
        user_id=user_id,
        name=template.title,
        description=template.description,
        icon=template.icon,
        preview_image=template.preview_image,
        categories=list(template.categories or []),
        tags=list(template.tags or []),
        source_template_id=template.id,
        source_template_slug=template.slug,
        source_template_version=template.version,
        rules=copy.deepcopy(template.rules or {}),
        checklist=_normalize_checklist(copy.deepcopy(template.checklist or [])),
    )
    db.add(row)
    db.flush()
    _sync_strategy_master(db, user_id, row.name)
    return row


def update_playbook(db: Session, user_id: uuid.UUID, playbook_id: uuid.UUID, payload: PlaybookUpdate) -> Playbook:
    row = get_playbook(db, user_id, playbook_id)
    data = payload.model_dump(exclude_unset=True)
    if "checklist" in data:
        data["checklist"] = _normalize_checklist(data.get("checklist"))
    for key, value in data.items():
        setattr(row, key, value)
    db.flush()
    if "name" in data and row.name:
        _sync_strategy_master(db, user_id, row.name)
    return row


def archive_playbook(db: Session, user_id: uuid.UUID, playbook_id: uuid.UUID) -> None:
    row = get_playbook(db, user_id, playbook_id)
    row.is_archived = True
    db.flush()
