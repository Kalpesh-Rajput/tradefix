from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.agent_run import AgentRun
from app.models.user_agent import UserAgent
from app.services.ai.agents.registry import get_template
from app.services.ai.tools.context import ToolContext


def list_user_agents(ctx: ToolContext, _args: dict) -> dict:
    rows = ctx.db.scalars(select(UserAgent).where(UserAgent.user_id == ctx.user_id).order_by(UserAgent.created_at.asc())).all()
    agents = []
    for row in rows:
        template = get_template(row.template_key)
        agents.append(
            {
                "id": str(row.id),
                "name": template.name if template else row.template_key,
                "template_key": row.template_key,
                "status": row.status,
                "triggers": list(row.trigger_types or []),
                "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
                "href": "/agents",
            }
        )
    return {"agents": agents, "count": len(agents)}


def get_agent_activity(ctx: ToolContext, args: dict) -> dict:
    limit = min(int(args.get("limit") or 8), 20)
    rows = ctx.db.scalars(
        select(AgentRun).where(AgentRun.user_id == ctx.user_id).order_by(AgentRun.run_at.desc()).limit(limit)
    ).all()
    runs = [_run_payload(row) for row in rows]
    return {"runs": runs, "count": len(runs)}


def get_agent_run(ctx: ToolContext, args: dict) -> dict:
    raw_id = args.get("run_id") or args.get("id")
    query = (args.get("query") or args.get("agent") or "").lower()
    stmt = select(AgentRun).where(AgentRun.user_id == ctx.user_id)
    if raw_id:
        try:
            stmt = stmt.where(AgentRun.id == uuid.UUID(str(raw_id)))
        except ValueError:
            return {"error": True, "message": "That run id is not valid."}
    elif "session" in query:
        stmt = stmt.where(AgentRun.agent_name == "session_review")
    elif "tag" in query:
        stmt = stmt.where(AgentRun.agent_name == "trade_tagger")
    elif "market" in query or "brief" in query:
        stmt = stmt.where(AgentRun.agent_name == "market_briefing")
    run = ctx.db.scalar(stmt.order_by(AgentRun.run_at.desc()).limit(1))
    if run is None:
        return {"error": True, "message": "No matching agent run is saved."}
    return _run_payload(run)


def _run_payload(run: AgentRun) -> dict:
    template = get_template(run.agent_name)
    status = run.status.value if hasattr(run.status, "value") else str(run.status)
    output = run.output or {}
    return {
        "id": str(run.id),
        "agent": template.name if template else run.agent_name,
        "status": status,
        "trigger": run.trigger,
        "summary": output.get("summary") or run.message,
        "error": run.error,
        "warnings": output.get("warnings") or [],
        "findings": [
            {"text": item.get("text"), "evidence": item.get("evidence"), "trade_ids": item.get("trade_ids")}
            for item in (output.get("findings") or [])[:6]
        ],
        "run_at": run.run_at.isoformat() if run.run_at else None,
        "href": f"/agents?run={run.id}",
    }
