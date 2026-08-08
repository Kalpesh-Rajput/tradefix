from datetime import datetime, timezone
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
    GoogleAuthRequest,
    LoginRequest,
    OnboardingUpdateRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,
    _REFERRAL_DETAILS,
)
from app.services.google_auth import verify_google_id_token
from app.services.rate_limit import avatar_upload_limiter, password_change_limiter
from app.services.storage import delete_local_upload, save_avatar

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _validate_referral_pair(source: str | None, detail: str | None) -> None:
    if not source:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Referral source is required")
    allowed = _REFERRAL_DETAILS.get(source)
    if allowed is None:
        # friend / reddit — no detail required
        return
    if source == "other":
        if not (detail or "").strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please specify how you heard about us")
        return
    cleaned = (detail or "").strip().lower()
    if cleaned not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please specify a referral detail")


def _apply_onboarding(user: User, data: dict) -> None:
    if "onboarding_step" in data and data["onboarding_step"] is not None:
        user.onboarding_step = data["onboarding_step"]
    if "trading_experience" in data:
        user.trading_experience = data["trading_experience"]
    if "capital_sources" in data and data["capital_sources"] is not None:
        user.capital_sources = data["capital_sources"]
    if "primary_broker" in data:
        user.primary_broker = data["primary_broker"]
    if "markets_traded" in data and data["markets_traded"] is not None:
        user.markets_traded = data["markets_traded"]
    if "onboarding_goals" in data and data["onboarding_goals"] is not None:
        user.onboarding_goals = data["onboarding_goals"]
    if "referral_source" in data:
        user.referral_source = data["referral_source"]
        # Clear stale detail when source changes without a new detail
        if "referral_detail" not in data:
            user.referral_detail = None
    if "referral_detail" in data:
        user.referral_detail = data["referral_detail"]


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
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google sign-in. Sign in with Google instead.",
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    idinfo = verify_google_id_token(payload.id_token)

    google_sub = idinfo.get("sub")
    email = (idinfo.get("email") or "").strip().lower()
    email_verified = idinfo.get("email_verified", False)
    name = (idinfo.get("name") or "").strip() or (email.split("@")[0] if email else "Trader")

    if not google_sub or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account is missing email",
        )
    if not email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google email is not verified",
        )

    user = db.scalar(select(User).where(User.google_id == google_sub))
    if not user:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            user.google_id = google_sub
            if not user.name and name:
                user.name = name
            db.add(user)
        else:
            user = User(
                email=email,
                password_hash=None,
                google_id=google_sub,
                auth_provider="google",
                name=name,
            )
            db.add(user)
            db.flush()
            account = Account(user_id=user.id, name=name or "Main Account", is_default=True)
            db.add(account)

    db.commit()
    db.refresh(user)
    logger.info("Google auth success user=%s provider=%s", user.id, user.auth_provider)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me/onboarding", response_model=UserResponse)
def update_onboarding(
    payload: OnboardingUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.onboarding_completed_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Onboarding already completed")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No onboarding fields provided")

    source = data.get("referral_source", current_user.referral_source)
    detail = data.get("referral_detail", current_user.referral_detail)
    if "referral_source" in data or "referral_detail" in data:
        if source in _REFERRAL_DETAILS or source == "other":
            # Soft-validate when both present; allow partial saves mid-step
            if detail is not None and source:
                allowed = _REFERRAL_DETAILS.get(source or "")
                if source == "other" and not str(detail).strip():
                    pass
                elif allowed and str(detail).strip().lower() not in allowed and source != "other":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid referral detail for selected source",
                    )

    _apply_onboarding(current_user, data)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    logger.info("Onboarding progress user=%s step=%s", current_user.id, current_user.onboarding_step)
    return current_user


@router.post("/me/onboarding/complete", response_model=UserResponse)
def complete_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.onboarding_completed_at:
        return current_user

    if not current_user.trading_experience:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trading experience is required")
    if not current_user.capital_sources:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Capital source is required")
    if not (current_user.primary_broker or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Primary broker is required")
    if not current_user.markets_traded:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select at least one market")
    if not current_user.onboarding_goals:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select at least one goal")
    _validate_referral_pair(current_user.referral_source, current_user.referral_detail)

    current_user.onboarding_step = 6
    current_user.onboarding_completed_at = datetime.now(timezone.utc)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    logger.info("Onboarding completed user=%s", current_user.id)
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

    if not current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google sign-in and has no password to change.",
        )

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
