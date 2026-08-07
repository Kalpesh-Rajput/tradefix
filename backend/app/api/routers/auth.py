import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.account import Account
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,
)
from app.services.rate_limit import avatar_upload_limiter, password_change_limiter
from app.services.storage import delete_local_upload, save_avatar

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=payload.email, password_hash=hash_password(payload.password), name=payload.name)
    db.add(user)
    db.flush()

    account_name = (payload.name or "").strip() or "Main Account"
    account = Account(user_id=user.id, name=account_name, is_default=True)
    db.add(account)

    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump(exclude_unset=True)

    if "username" in data:
        username = data["username"]
        if username:
            username = username.strip().lstrip("@").lower()
            taken = db.scalar(
                select(User).where(User.username == username, User.id != current_user.id)
            )
            if taken:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
            data["username"] = username
        else:
            data["username"] = None

    required_strings = {"timezone", "language", "date_format", "theme", "accent_color"}
    list_fields = {
        "default_strategies",
        "custom_strategies",
        "strategy_order",
        "custom_mistakes",
        "mistake_order",
    }
    nullable_numerics = {
        "default_quantity",
        "default_fee",
        "default_forex_leverage",
        "weekly_goal",
        "monthly_goal",
        "yearly_goal",
        "target_trades",
    }

    for field, value in data.items():
        if field == "name":
            if not isinstance(value, str) or not value.strip():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
            setattr(current_user, field, value.strip())
            continue
        if field in required_strings:
            if not isinstance(value, str) or not value.strip():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field} is required")
            setattr(current_user, field, value.strip())
            continue
        if field == "journal_template" and isinstance(value, str):
            setattr(current_user, field, value.strip() or None)
            continue
        if field == "default_symbol":
            setattr(current_user, field, value.strip().upper() if isinstance(value, str) and value.strip() else None)
            continue
        if field in list_fields:
            setattr(current_user, field, value if isinstance(value, list) else [])
            continue
        if field in nullable_numerics:
            setattr(current_user, field, value)
            continue
        if isinstance(value, str):
            value = value.strip() or None
        setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    logger.info("Updated profile user=%s fields=%s", current_user.id, list(data.keys()))
    return current_user


@router.post("/me/password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    password_change_limiter.check(str(current_user.id))

    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
    logger.info("Password changed user=%s", current_user.id)
    return {"ok": True, "message": "Password updated"}


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    avatar_upload_limiter.check(str(current_user.id))

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    if len(data) > settings.max_avatar_bytes:
        max_mb = settings.max_avatar_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image must be {max_mb:.0f}MB or smaller",
        )

    previous = current_user.avatar_url
    try:
        url = save_avatar(current_user.id, data, file.content_type)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Avatar save failed user=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save avatar",
        ) from None

    current_user.avatar_url = url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    delete_local_upload(previous)
    logger.info("Avatar uploaded user=%s url=%s", current_user.id, url)
    return current_user


@router.delete("/me/avatar", response_model=UserResponse)
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    previous = current_user.avatar_url
    if not previous:
        return current_user

    current_user.avatar_url = None
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    delete_local_upload(previous)
    logger.info("Avatar deleted user=%s", current_user.id)
    return current_user
