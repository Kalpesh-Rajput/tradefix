"""Backend Google OAuth helpers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


def verify_google_id_token(token: str) -> dict[str, Any]:
    """Verify a Google ID token and return the decoded claims."""
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured",
        )

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        idinfo = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        logger.warning("Invalid Google ID token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential",
        ) from None
    except Exception:
        logger.exception("Google token verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify Google credential",
        ) from None

    if idinfo.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential")

    return idinfo
