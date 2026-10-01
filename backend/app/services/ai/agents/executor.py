"""Single entry point for every agent run."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agent_run import AgentRun, AgentRunStatus
from app.models.user import User
from app.models.user_agent import UserAgent
from app.services.ai.agents.context import build_market_context, build_session_context, build_trade_context
from app.services.ai.agents.logic import AgentInactive, OutputRejected, assert_active
from app.services.ai.agents.publish import (
    assert_writes,
    notify,
    upsert_ai_note,
    write_briefing,
    write_recap,
    write_trade_tags,
)
from app.services.ai.agents.registry import get_template
from app.services.ai.agents.templates import build_market_briefing, build_session_review, build_trade_tags
from app.services.ai.openrouter_client import AiNotConfiguredError, generate_text

logger = logging.getLogger("tradefix.agents")

BUILDERS = {
    "market_briefing": build_market_briefing,
    "session_review": build_session_review,
    "trade_tagger": build_trade_tags,
}


def default_generate(system: str, user_prompt: str) -> str:
    try:
        return generate_text(system, user_prompt, max_tokens=700)
    except AiNotConfiguredError as exc:
        raise OutputRejected(str(exc)) from exc
    except OutputRejected:
        raise
    except Exception as exc:  # noqa: BLE001
        raise OutputRejected(f"Agent run failed: {exc}") from exc


def execute(
    db: Session,
    user: User,
    agent: UserAgent,
    *,
    trigger: str,
    account_id: uuid.UUID | None = None,
    day: date | None = None,
    trade_ids: list[uuid.UUID] | None = None,
    generate=None,
) -> AgentRun:
    assert_active(agent.status)
    template = get_template(agent.template_key)
    if template is None or not template.implemented:
        raise OutputRejected("This agent is not available.")
    if trigger not in template.triggers:
        raise OutputRejected("This trigger is not enabled for the agent.")
    if trigger != "manual" and trigger not in (agent.trigger_types or []):
        raise AgentInactive("This trigger is turned off.")

    now = datetime.now(timezone.utc)
    run = AgentRun(
        user_id=user.id,
        user_agent_id=agent.id,
        agent_name=template.key,
        status=AgentRunStatus.running,
        trigger=trigger,
        started_at=now,
        run_at=now,
        input_context={},
        output={},
        details={"account_id": str(account_id) if account_id else None, "date": day.isoformat() if day else None},
    )
    db.add(run)
    db.flush()

    try:
        context = _context(db, user.id, template.key, agent, account_id, day, trade_ids or [])
        run.input_context = _public_context(context)
        output = BUILDERS[template.key](context, generate or default_generate)
        changes = _publish(db, user, template.key, template.writes, output, account_id, day, run.id)
        output["changes"] = changes
        run.output = output
        run.message = str(output.get("summary") or "")[:1000]
        run.status = AgentRunStatus.partial if output.get("warnings") else AgentRunStatus.completed
        run.completed_at = datetime.now(timezone.utc)
        run.details = {**(run.details or {}), "trades_analyzed": context.get("trade_count", 0)}
        agent.last_run_at = run.completed_at
        _notify_done(db, user.id, run, template.name, output)
        db.commit()
        db.refresh(run)
        return run
    except OutputRejected as exc:
        db.rollback()
        return _fail(db, user, agent, template.key, trigger, account_id, day, str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Agent %s failed", template.key)
        db.rollback()
        return _fail(db, user, agent, template.key, trigger, account_id, day, f"Agent run failed: {exc}")


def _fail(db, user, agent, key, trigger, account_id, day, error: str) -> AgentRun:
    now = datetime.now(timezone.utc)
    run = AgentRun(
        user_id=user.id,
        user_agent_id=agent.id,
        agent_name=key,
        status=AgentRunStatus.failed,
        trigger=trigger,
        message=error[:1000],
        error=error[:4000],
        started_at=now,
        completed_at=now,
        run_at=now,
        input_context={},
        output={},
        details={"account_id": str(account_id) if account_id else None, "date": day.isoformat() if day else None},
    )
    db.add(run)
    db.flush()
    agent.last_run_at = now
    notify(db, user.id, run.id, "Agent failed", error[:240], f"/agents?run={run.id}")
    db.commit()
    db.refresh(run)
    return run


def _context(db, user_id, key, agent, account_id, day, trade_ids):
    if key == "market_briefing":
        return build_market_context(db, user_id, account_id, day, agent.configuration or {}, agent.instructions or "")
    if key == "session_review":
        return build_session_context(db, user_id, account_id, day)
    payload = build_trade_context(db, user_id, trade_ids, agent.instructions or "")
    payload["mode"] = (agent.configuration or {}).get("mode") or "suggest"
    return payload


def _public_context(context: dict) -> dict:
    trades = context.get("trades") or []
    return {
        "kind": context.get("kind"),
        "date": context.get("date"),
        "trade_count": context.get("trade_count", len(trades)),
        "symbols": context.get("symbols") or [],
        "warnings": context.get("warnings") or [],
        "trade_ids": [trade.get("id") for trade in trades if trade.get("id")],
    }


def _publish(db, user, key, writes, output, account_id, day, run_id) -> list[str]:
    changes: list[str] = []
    requested: set[str] = set()
    if key == "market_briefing":
        if account_id and day:
            requested.update({"day_plan_briefing", "notebook_note"})
            assert_writes(writes, requested)
            text = _briefing_text(output)
            changes.append(write_briefing(db, user, account_id, day, text))
            changes.append(
                upsert_ai_note(db, user.id, account_id, day, "ai_market_briefing", output["title"], output["summary"], run_id)
            )
        else:
            output.setdefault("warnings", []).append("Briefing was not saved because the day or account was missing.")
        return changes
    if key == "session_review":
        if account_id and day:
            requested.update({"daily_recap", "notebook_note"})
            assert_writes(writes, requested)
            changes.append(
                write_recap(
                    db,
                    user.id,
                    account_id,
                    day,
                    output["summary"],
                    output.get("best_decision"),
                    output.get("action_labels") or [],
                )
            )
            changes.append(
                upsert_ai_note(db, user.id, account_id, day, "ai_session_review", output["title"], output["summary"], run_id)
            )
        else:
            output.setdefault("warnings", []).append("Review was not saved because the day or account was missing.")
        return changes
    requested.update({"setup_tags", "ai_tag_suggestions"})
    assert_writes(writes, requested)
    tagged = 0
    for row in output.get("tag_results") or []:
        applied = [item["tag"] for item in row.get("apply") or []]
        suggestions = row.get("suggest") or []
        write_trade_tags(db, user.id, row["trade_id"], applied, suggestions)
        tagged += 1
    if tagged:
        changes.append(f"Updated {tagged} trades.")
    return changes


def _briefing_text(output: dict) -> str:
    lines = [output.get("summary") or ""]
    for finding in output.get("findings") or []:
        evidence = "; ".join(finding.get("evidence") or [])
        lines.append(f"- {finding.get('text')} ({evidence})")
    for warning in output.get("warnings") or []:
        lines.append(f"Warning: {warning}")
    return "\n".join(line for line in lines if line).strip()


def _notify_done(db, user_id, run: AgentRun, name: str, output: dict) -> None:
    if run.status not in {AgentRunStatus.completed, AgentRunStatus.partial}:
        return
    day = (run.details or {}).get("date")
    if run.agent_name == "session_review" and day:
        href = f"/day?date={day}"
    elif run.agent_name == "market_briefing" and day:
        href = f"/my-day?date={day}"
    elif run.agent_name == "trade_tagger":
        ids = (run.input_context or {}).get("trade_ids") or []
        href = "/trades?ids=" + ",".join(ids) if ids else f"/agents?run={run.id}"
    else:
        href = f"/agents?run={run.id}"
    title = f"{name} completed" if run.status == AgentRunStatus.completed else f"{name} needs a look"
    notify(db, user_id, run.id, title, str(output.get("summary") or "")[:240], href)


def run_import_tagger(db: Session, user_id: uuid.UUID, trade_ids: list[uuid.UUID]) -> AgentRun | None:
    if not trade_ids:
        return None
    user = db.get(User, user_id)
    if user is None:
        return None
    agent = db.scalar(
        select(UserAgent).where(UserAgent.user_id == user_id, UserAgent.template_key == "trade_tagger")
    )
    if agent is None:
        return None
    try:
        return execute(db, user, agent, trigger="after_import", trade_ids=trade_ids)
    except AgentInactive:
        return None


def sweep_stale_runs(db: Session, older_than_minutes: int = 10) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
    rows = db.scalars(
        select(AgentRun).where(AgentRun.status == AgentRunStatus.running, AgentRun.started_at < cutoff)
    ).all()
    now = datetime.now(timezone.utc)
    for run in rows:
        run.status = AgentRunStatus.failed
        run.error = "The run was interrupted before it finished."
        run.message = run.error
        run.completed_at = now
    if rows:
        db.commit()
    return len(rows)
