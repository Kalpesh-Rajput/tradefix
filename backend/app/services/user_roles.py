"""Role grants for operators (D-026)."""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User

logger = logging.getLogger(__name__)

ADMIN = "admin"
TRADER = "trader"


def set_admin(db: Session, email: str, *, revoke: bool = False) -> tuple[User, bool]:
    """Grant (or revoke) the admin role. Idempotent; returns (user, changed)."""
    user = db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))
    if user is None:
        raise LookupError(f"no user with email {email}")
    target = TRADER if revoke else ADMIN
    changed = user.role != target
    if changed:
        previous = user.role
        user.role = target
        db.commit()
        logger.info("user role changed", extra={"user_id": str(user.id), "from": previous, "to": target})
    return user, changed
