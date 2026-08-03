from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.agent_run import AgentRun
from app.models.insight import Insight
from app.models.user import User
from app.schemas.agent import AgentRunResponse, AgentTriggerResponse
from app.schemas.insight import InsightResponse
from app.services.ai.agents import AGENT_REGISTRY

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=list[str])
def list_agents():
    return list(AGENT_REGISTRY.keys())


@router.get("/runs", response_model=list[AgentRunResponse])
def list_agent_runs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = (
        select(AgentRun)
        .where(AgentRun.user_id == current_user.id)
        .order_by(AgentRun.run_at.desc())
        .limit(100)
    )
    return db.scalars(stmt).all()


@router.get("/insights", response_model=list[InsightResponse])
def list_agent_insights(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = (
        select(Insight)
        .where(Insight.user_id == current_user.id, Insight.agent_name.is_not(None))
        .order_by(Insight.created_at.desc())
        .limit(100)
    )
    return db.scalars(stmt).all()


@router.post("/{agent_name}/run", response_model=AgentTriggerResponse)
def run_agent_now(agent_name: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    agent = AGENT_REGISTRY.get(agent_name)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown agent")

    run = agent.run(db, current_user.id)

    insight_dict = None
    if run.insight_id:
        insight = db.get(Insight, run.insight_id)
        if insight:
            insight_dict = InsightResponse.model_validate(insight).model_dump(mode="json")

    return AgentTriggerResponse(
        agent_name=agent_name,
        run=AgentRunResponse.model_validate(run),
        insight=insight_dict,
    )
