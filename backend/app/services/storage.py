"""Local file storage for user uploads (avatars, future trade screenshots).

Files live under `settings.upload_dir` and are served at `/uploads/...`.
Swap this module for S3/Cloudinary later without changing API contracts —
endpoints still return and store URL paths.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_AVATAR_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

def detect_image_mime(data: bytes) -> str | None:
    if len(data) < 12:
        return None
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _uploads_root() -> Path:
    root = Path(settings.upload_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def avatar_dir(user_id: uuid.UUID) -> Path:
    path = _uploads_root() / "avatars" / str(user_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def public_upload_url(relative_path: str) -> str:
    """Return URL path served by StaticFiles mount (e.g. /uploads/avatars/…)."""
    return f"/uploads/{relative_path.lstrip('/')}"


def save_avatar(user_id: uuid.UUID, data: bytes, declared_content_type: str | None) -> str:
    if len(data) > settings.max_avatar_bytes:
        max_mb = settings.max_avatar_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image must be {max_mb:.0f}MB or smaller",
        )

    mime = detect_image_mime(data)
    if mime is None or mime not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image. Use PNG, JPG, or WEBP",
        )

    if declared_content_type and declared_content_type.lower() not in (
        mime,
        "image/jpg",  # browsers sometimes send image/jpg
        "application/octet-stream",
    ):
        # Soft check: trust magic bytes over client Content-Type, but reject obvious mismatches
        declared = declared_content_type.lower().replace("image/jpg", "image/jpeg")
        if declared.startswith("image/") and declared != mime:
            logger.warning(
                "Avatar content-type mismatch user=%s declared=%s detected=%s",
                user_id,
                declared_content_type,
                mime,
            )

    ext = ALLOWED_AVATAR_TYPES[mime]
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = avatar_dir(user_id) / filename
    dest.write_bytes(data)
    logger.info("Saved avatar user=%s path=%s bytes=%s", user_id, dest, len(data))
    return public_upload_url(f"avatars/{user_id}/{filename}")


def recap_screenshot_dir(user_id: uuid.UUID, recap_id: uuid.UUID) -> Path:
    path = _uploads_root() / "recaps" / str(user_id) / str(recap_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_recap_screenshot(
    user_id: uuid.UUID,
    recap_id: uuid.UUID,
    data: bytes,
    declared_content_type: str | None,
) -> str:
    if len(data) > settings.max_screenshot_bytes:
        max_mb = settings.max_screenshot_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image must be {max_mb:.0f}MB or smaller",
        )

    mime = detect_image_mime(data)
    if mime is None or mime not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image. Use PNG, JPG, or WEBP",
        )

    if declared_content_type and declared_content_type.lower() not in (
        mime,
        "image/jpg",
        "application/octet-stream",
    ):
        declared = declared_content_type.lower().replace("image/jpg", "image/jpeg")
        if declared.startswith("image/") and declared != mime:
            logger.warning(
                "Screenshot content-type mismatch user=%s declared=%s detected=%s",
                user_id,
                declared_content_type,
                mime,
            )

    ext = ALLOWED_AVATAR_TYPES[mime]
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = recap_screenshot_dir(user_id, recap_id) / filename
    dest.write_bytes(data)
    logger.info("Saved recap screenshot user=%s recap=%s path=%s bytes=%s", user_id, recap_id, dest, len(data))
    return public_upload_url(f"recaps/{user_id}/{recap_id}/{filename}")


def trade_screenshot_dir(user_id: uuid.UUID, trade_id: uuid.UUID) -> Path:
    path = _uploads_root() / "trades" / str(user_id) / str(trade_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_trade_screenshot(
    user_id: uuid.UUID,
    trade_id: uuid.UUID,
    data: bytes,
    declared_content_type: str | None,
) -> str:
    if len(data) > settings.max_screenshot_bytes:
        max_mb = settings.max_screenshot_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image must be {max_mb:.0f}MB or smaller",
        )

    mime = detect_image_mime(data)
    if mime is None or mime not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image. Use PNG, JPG, or WEBP",
        )

    ext = ALLOWED_AVATAR_TYPES[mime]
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = trade_screenshot_dir(user_id, trade_id) / filename
    dest.write_bytes(data)
    logger.info("Saved trade screenshot user=%s trade=%s path=%s bytes=%s", user_id, trade_id, dest, len(data))
    return public_upload_url(f"trades/{user_id}/{trade_id}/{filename}")


def save_trade_voice(user_id: uuid.UUID, trade_id: uuid.UUID, data: bytes, ext: str = ".webm") -> str:
    max_bytes = 10 * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio must be 10MB or smaller")
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio")
    safe_ext = ext if ext.startswith(".") else f".{ext}"
    if safe_ext.lower() not in (".webm", ".mp3", ".wav", ".m4a", ".ogg"):
        safe_ext = ".webm"
    filename = f"{uuid.uuid4().hex}{safe_ext}"
    dest = trade_screenshot_dir(user_id, trade_id) / filename
    dest.write_bytes(data)
    return public_upload_url(f"trades/{user_id}/{trade_id}/{filename}")


def delete_local_upload(url: str | None) -> None:
    """Delete a previously stored upload if it lives under our uploads root."""
    if not url or not url.startswith("/uploads/"):
        return
    relative = url.removeprefix("/uploads/")
    path = (_uploads_root() / relative).resolve()
    root = _uploads_root()
    try:
        path.relative_to(root)
    except ValueError:
        logger.warning("Refused to delete path outside uploads: %s", path)
        return
    if path.is_file():
        path.unlink(missing_ok=True)
        logger.info("Deleted upload %s", path)
