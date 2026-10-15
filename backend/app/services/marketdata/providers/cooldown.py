"""Provider cool-down after a block. Fetches are skipped until blocked_until; nothing is retried in a loop."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.market_data import ProviderCooldown
from app.services.marketdata.providers.base import BLOCKED_MESSAGE, ProviderBlocked, ProviderError


def active(db: Session, provider: str, *, now: datetime | None = None) -> ProviderCooldown | None:
    row = db.get(ProviderCooldown, provider)
    moment = now or datetime.now(timezone.utc)
    if row is None or row.blocked_until <= moment:
        return None
    return row


def raise_if_blocked(db: Session, provider: str) -> None:
    row = active(db, provider)
    if row is not None:
        raise ProviderError("provider_blocked", BLOCKED_MESSAGE, retryable=False)


def record(db: Session, provider: str, exc: ProviderBlocked) -> None:
    until = datetime.now(timezone.utc) + timedelta(seconds=settings.dukascopy_block_cooldown_s)
    row = db.get(ProviderCooldown, provider)
    if row is None:
        row = ProviderCooldown(
            provider=provider,
            blocked_until=until,
            http_status=exc.http_status,
            excerpt=exc.excerpt or "",
            detected_at=datetime.now(timezone.utc),
        )
        db.add(row)
    else:
        row.blocked_until = until
        row.http_status = exc.http_status
        row.excerpt = exc.excerpt or ""
        row.detected_at = datetime.now(timezone.utc)
    db.commit()
