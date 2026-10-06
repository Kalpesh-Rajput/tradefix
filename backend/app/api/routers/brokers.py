import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.broker import OAuthState
from app.models.user import User
from app.services.brokers.connections import create_connection
from app.services.brokers.errors import BrokerError
from app.services.brokers.providers.ctrader import authorize_url
from app.services.brokers.providers.ctrader import CTraderConnector
from app.services.brokers.registry import get_provider, list_providers

router = APIRouter(prefix="/api/brokers", tags=["brokers"])


@router.get("")
def broker_catalog(_: User = Depends(get_current_user)):
    return {"brokers": list_providers()}


@router.get("/ctrader/authorize")
def ctrader_authorize(
    environment: str = "demo",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    state = secrets.token_urlsafe(32)
    db.add(
        OAuthState(
            state=state,
            user_id=current_user.id,
            provider="ctrader",
            payload={"environment": environment if environment in {"demo", "live"} else "demo"},
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        )
    )
    db.commit()
    return {"url": authorize_url(state, environment)}


@router.get("/ctrader/callback")
def ctrader_callback(code: str, state: str, db: Session = Depends(get_db)):
    row = db.get(OAuthState, state)
    if row is None or row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This cTrader authorization session expired. Start again.")
    tokens = CTraderConnector().exchange_code(code)
    environment = (row.payload or {}).get("environment") or "demo"
    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="User not found.")
    connection, run = create_connection(
        db,
        user,
        {
            "provider": "ctrader",
            "environment": environment,
            "credentials": {
                "environment": environment,
                "access_token": tokens["accessToken"],
                "refresh_token": tokens.get("refreshToken") or "",
                "expires_in": str(tokens.get("expiresIn") or tokens.get("expires_in") or ""),
            },
        },
    )
    db.delete(row)
    db.commit()
    target = settings.frontend_origin.split(",")[0].rstrip("/")
    return RedirectResponse(f"{target}/settings/broker?connected={connection.id}&run={run.id}")


@router.get("/{provider_id}")
def broker_detail(provider_id: str, _: User = Depends(get_current_user)):
    try:
        return get_provider(provider_id).public()
    except BrokerError as exc:
        raise HTTPException(status_code=exc.http_status, detail=exc.as_dict()) from exc
