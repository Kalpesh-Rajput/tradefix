import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.agent_run import AgentRun
from app.models.trade import Trade
from app.models.user import User
from app.models.user_agent import UserAgent, UserAgentStatus
from app.models.user_notification import UserNotification
from app.schemas.agent import (
    AgentRunRequest,
    AgentRunResponse,
    AgentTemplateResponse,
    NotificationResponse,
    TagDecision,
    UserAgentCreate,
    UserAgentResponse,
    UserAgentUpdate,
    run_to_response,
)
from app.services.ai.agents.executor import execute
from app.services.ai.agents.logic import AgentInactive, OutputRejected, accept_suggestion, reject_suggestion
from app.services.ai.agents.registry import clean_config, clean_triggers, get_template, public_templates

router = APIRouter(prefix="/api/agents", tags=["agents"])
notify_router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _agent_or_404(db: Session, user: User, agent_id: uuid.UUID) -> UserAgent:
    agent = db.get(UserAgent, agent_id)
    if agent is None or agent.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


def _last_run(db: Session, agent: UserAgent) -> AgentRun | None:
    return db.scalar(
        select(AgentRun).where(AgentRun.user_agent_id == agent.id).order_by(AgentRun.run_at.desc()).limit(1)
    )


def _to_agent(db: Session, agent: UserAgent) -> UserAgentResponse:
    template = get_template(agent.template_key)
    last = _last_run(db, agent)
    status_value = last.status.value if last is not None and hasattr(last.status, "value") else (str(last.status) if last else None)
    return UserAgentResponse(
        id=agent.id,
        template_key=agent.template_key,
        name=template.name if template else agent.template_key,
        description=template.description if template else "",
        category=template.category if template else "",
        status=agent.status,
        trigger_types=list(agent.trigger_types or []),
        configuration=agent.configuration or {},
        instructions=agent.instructions or "",
        last_run_at=agent.last_run_at,
        last_summary=last.message if last else None,
        last_status=status_value,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.get("/templates", response_model=list[AgentTemplateResponse])
def list_templates():
    return public_templates()


@router.get("", response_model=list[UserAgentResponse])
def list_agents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(select(UserAgent).where(UserAgent.user_id == current_user.id).order_by(UserAgent.created_at.asc())).all()
    return [_to_agent(db, row) for row in rows]


@router.post("", response_model=UserAgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(payload: UserAgentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    template = get_template(payload.template_key)
    if template is None or not template.implemented:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown agent")
    existing = db.scalar(
        select(UserAgent).where(UserAgent.user_id == current_user.id, UserAgent.template_key == payload.template_key)
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This agent already exists")
    status_value = payload.status if payload.status in {UserAgentStatus.active.value, UserAgentStatus.paused.value} else "active"
    agent = UserAgent(
        user_id=current_user.id,
        template_key=payload.template_key,
        status=status_value,
        trigger_types=clean_triggers(payload.template_key, payload.trigger_types or list(template.triggers)),
        configuration=clean_config(payload.template_key, payload.configuration),
        instructions=(payload.instructions or "")[:4000],
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return _to_agent(db, agent)


@router.patch("/{agent_id}", response_model=UserAgentResponse)
def update_agent(agent_id: uuid.UUID, payload: UserAgentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    agent = _agent_or_404(db, current_user, agent_id)
    if payload.status is not None:
        if payload.status not in {UserAgentStatus.active.value, UserAgentStatus.paused.value}:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Status must be active or paused")
        agent.status = payload.status
    if payload.trigger_types is not None:
        agent.trigger_types = clean_triggers(agent.template_key, payload.trigger_types)
    if payload.configuration is not None:
        agent.configuration = clean_config(agent.template_key, {**(agent.configuration or {}), **payload.configuration})
    if payload.instructions is not None:
        agent.instructions = payload.instructions[:4000]
    db.commit()
    db.refresh(agent)
    return _to_agent(db, agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    agent = _agent_or_404(db, current_user, agent_id)
    db.delete(agent)
    db.commit()


@router.post("/{agent_id}/run", response_model=AgentRunResponse)
def run_agent(agent_id: uuid.UUID, payload: AgentRunRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    agent = _agent_or_404(db, current_user, agent_id)
    try:
        run = execute(
            db,
            current_user,
            agent,
            trigger=payload.trigger,
            account_id=payload.account_id,
            day=payload.date,
            trade_ids=payload.trade_ids,
        )
    except AgentInactive as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except OutputRejected as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return run_to_response(run)


@router.get("/runs", response_model=list[AgentRunResponse])
def list_runs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(AgentRun).where(AgentRun.user_id == current_user.id).order_by(AgentRun.run_at.desc()).limit(50)
    ).all()
    return [run_to_response(row) for row in rows]


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
def get_run(run_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    run = db.get(AgentRun, run_id)
    if run is None or run.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run_to_response(run)


@router.post("/runs/{run_id}/retry", response_model=AgentRunResponse)
def retry_run(run_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    previous = db.get(AgentRun, run_id)
    if previous is None or previous.user_id != current_user.id or previous.user_agent_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    agent = _agent_or_404(db, current_user, previous.user_agent_id)
    details = previous.details or {}
    account_id = uuid.UUID(details["account_id"]) if details.get("account_id") else None
    day = datetime.fromisoformat(details["date"]).date() if details.get("date") else None
    trade_ids = [uuid.UUID(item) for item in (previous.input_context or {}).get("trade_ids") or []]
    try:
        run = execute(
            db,
            current_user,
            agent,
            trigger=previous.trigger or "manual",
            account_id=account_id,
            day=day,
            trade_ids=trade_ids,
        )
    except AgentInactive as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except OutputRejected as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return run_to_response(run)


@notify_router.get("", response_model=list[NotificationResponse])
def list_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(UserNotification)
        .where(UserNotification.user_id == current_user.id)
        .order_by(UserNotification.created_at.desc())
        .limit(30)
    ).all()
    return rows


@notify_router.post("/{notification_id}/read", response_model=NotificationResponse)
def read_notification(notification_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(UserNotification, notification_id)
    if row is None or row.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    row.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


def decide_tag(db: Session, user: User, trade_id: uuid.UUID, tag: str, accept: bool) -> Trade:
    trade = db.get(Trade, trade_id)
    if trade is None or trade.user_id != user.id or trade.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    suggestions = list(trade.ai_tag_suggestions or [])
    if accept:
        tags, suggestions = accept_suggestion(list(trade.setup_tags or []), suggestions, tag)
        trade.setup_tags = tags
        if tags and not trade.setup_tag:
            trade.setup_tag = tags[0]
    else:
        suggestions = reject_suggestion(suggestions, tag)
    trade.ai_tag_suggestions = suggestions
    db.commit()
    db.refresh(trade)
    return trade


tag_router = APIRouter(prefix="/api/trades", tags=["trades"])


@tag_router.post("/{trade_id}/ai-tags/accept")
def accept_ai_tag(trade_id: uuid.UUID, payload: TagDecision, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.api.routers.trades import _to_response

    trade = decide_tag(db, current_user, trade_id, payload.tag, True)
    return _to_response(trade)


@tag_router.post("/{trade_id}/ai-tags/reject")
def reject_ai_tag(trade_id: uuid.UUID, payload: TagDecision, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.api.routers.trades import _to_response

    trade = decide_tag(db, current_user, trade_id, payload.tag, False)
    return _to_response(trade)
