from __future__ import annotations

import json
import logging
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.ai.heuristic import classify_question, looks_like_data_question, looks_like_news_question, quick_reply
from app.services.ai.openrouter_client import (
    AIModelProvider,
    AiNotConfiguredError,
    AiProviderError,
    ChatResult,
    ToolCall,
    get_provider,
)
from app.services.ai.prompts import CHAT_SYSTEM_PROMPT, UNTRUSTED_DATA_INSTRUCTIONS
from app.services.ai.tools.context import SourceRef, ToolContext
from app.services.ai.tools.registry import ANALYTICS_TOOLS, RAG_TOOLS, TOOL_SCHEMAS, WEB_TOOLS, execute_tool
from app.services.ai.usage import record_usage
from app.services.rate_limit import check_ai_rate_limit

logger = logging.getLogger(__name__)

_JSON_TOOL = re.compile(
    r"\{[^{}]*\"(?:name|tool)\"\s*:\s*\"([A-Za-z0-9_]+)\"[^{}]*\}",
    re.S,
)


@dataclass
class ChatTurn:
    role: str
    content: str


@dataclass
class OrchestratorResult:
    answer: str
    intent: str
    tools_used: list[str] = field(default_factory=list)
    sources: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    request_id: str = ""
    locked: bool = False
    actions: list[str] = field(default_factory=list)


def _normalize_history(history: list[ChatTurn] | None) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for turn in history or []:
        role = turn.role
        if role in {"coach", "assistant"}:
            role = "assistant"
        elif role != "user":
            continue
        text = (turn.content or "").strip()
        if not text:
            continue
        messages.append({"role": role, "content": text[:4000]})
    return messages[-settings.ai_max_history_messages :]


def _parse_content_tool_calls(content: str | None) -> list[ToolCall]:
    if not content:
        return []
    calls: list[ToolCall] = []
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = None
    candidates: list[dict] = []
    if isinstance(parsed, dict):
        candidates.append(parsed)
    elif isinstance(parsed, list):
        candidates.extend(item for item in parsed if isinstance(item, dict))
    else:
        for match in _JSON_TOOL.finditer(content):
            try:
                blob = json.loads(match.group(0))
            except json.JSONDecodeError:
                continue
            if isinstance(blob, dict):
                candidates.append(blob)
    for blob in candidates:
        name = blob.get("name") or blob.get("tool")
        if not name:
            continue
        args = blob.get("arguments") or blob.get("args") or blob.get("parameters") or {}
        if not isinstance(args, dict):
            args = {}
        calls.append(ToolCall(id=f"parsed-{name}", name=str(name), arguments=args))
    return calls


def _intent_from_tools(tools_used: list[str], fallback: str) -> str:
    names = set(tools_used)
    has_sql = bool(names & ANALYTICS_TOOLS)
    has_rag = bool(names & RAG_TOOLS)
    has_web = bool(names & WEB_TOOLS)
    if has_web and (has_sql or has_rag):
        return "hybrid"
    if has_web:
        return "web_search"
    if has_sql and has_rag:
        return "hybrid"
    if has_rag:
        return "vector_search"
    if has_sql:
        if names <= {"get_trade_statistics", "get_trade_history"}:
            return "sql"
        return "analytics"
    return fallback


def _wrap_tool_payload(name: str, payload: dict) -> str:
    body = json.dumps(payload, default=str)[:6000]
    return (
        f"{UNTRUSTED_DATA_INSTRUCTIONS}\n"
        f"<TRADEFIX_DATA tool=\"{name}\">\n{body}\n</TRADEFIX_DATA>"
    )


def _extract_actions(answer: str) -> list[str]:
    actions = [
        line.lstrip("-• ").strip()
        for line in answer.splitlines()
        if line.strip().startswith(("-", "•"))
    ]
    return actions[:6]


def run_chat(
    db: Session,
    *,
    user_id: uuid.UUID,
    question: str,
    account_id: uuid.UUID | None = None,
    history: list[ChatTurn] | None = None,
    provider: AIModelProvider | None = None,
) -> OrchestratorResult:
    request_id = uuid.uuid4()
    started = time.perf_counter()
    model_id = None
    tools_used: list[str] = []
    input_tokens = 0
    output_tokens = 0
    ctx = ToolContext(db=db, user_id=user_id, account_id=account_id)
    check_ai_rate_limit(str(user_id))
    provider = provider or get_provider()
    model_id = provider.model_id
    plan = classify_question(question)

    def _add_usage(result: ChatResult) -> None:
        nonlocal input_tokens, output_tokens
        if result.usage.input_tokens is not None:
            input_tokens += result.usage.input_tokens
        if result.usage.output_tokens is not None:
            output_tokens += result.usage.output_tokens

    def _finish(answer: str, success: bool, error_code: str | None = None) -> OrchestratorResult:
        latency_ms = int((time.perf_counter() - started) * 1000)
        intent = _intent_from_tools(tools_used, plan.intent)
        total = None
        if input_tokens or output_tokens:
            total = (input_tokens or 0) + (output_tokens or 0)
        logger.info(
            "ai_request",
            extra={
                "request_id": str(request_id),
                "user_id": str(user_id),
                "model": model_id,
                "intent": intent,
                "tools": tools_used,
                "latency_ms": latency_ms,
                "status": "success" if success else "error",
            },
        )
        record_usage(
            db,
            user_id=user_id,
            request_id=request_id,
            model=model_id,
            input_tokens=input_tokens or None,
            output_tokens=output_tokens or None,
            total_tokens=total,
            request_type="chat",
            intent=intent,
            tools_used=tools_used,
            latency_ms=latency_ms,
            success=success,
            error_code=error_code,
        )
        return OrchestratorResult(
            answer=answer,
            intent=intent,
            tools_used=tools_used,
            sources=[source.as_dict() for source in ctx.sources],
            warnings=list(ctx.warnings),
            request_id=str(request_id),
            actions=_extract_actions(answer),
        )

    instant = quick_reply(question)
    if instant is not None:
        return _finish(instant, True)

    messages: list[dict[str, Any]] = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    messages.extend(_normalize_history(history))
    messages.append({"role": "user", "content": question.strip()})

    def _run_named_tools(calls: list[tuple[str, dict]]) -> list[dict]:
        results = []
        for name, args in calls:
            payload = execute_tool(name, args, ctx)
            tools_used.append(name)
            results.append({"name": name, "result": payload})
        return results

    heuristic_applied = False
    needs_tools = looks_like_data_question(question) or looks_like_news_question(question)
    attach_tools = bool(plan.tools) or needs_tools
    try:
        for iteration in range(max(1, settings.ai_max_tool_iterations)):
            result = provider.chat(
                messages,
                tools=TOOL_SCHEMAS if attach_tools else None,
                temperature=0.3,
                max_tokens=900,
            )
            _add_usage(result)
            calls = list(result.tool_calls or [])
            if not calls:
                calls = _parse_content_tool_calls(result.content)

            if calls:
                assistant_msg: dict[str, Any] = {"role": "assistant", "content": result.content or ""}
                serialized = []
                for call in calls:
                    serialized.append(
                        {
                            "id": call.id,
                            "type": "function",
                            "function": {
                                "name": call.name,
                                "arguments": json.dumps(call.arguments),
                            },
                        }
                    )
                assistant_msg["tool_calls"] = serialized
                messages.append(assistant_msg)
                for call in calls:
                    payload = execute_tool(call.name, call.arguments, ctx)
                    tools_used.append(call.name)
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.id,
                            "name": call.name,
                            "content": _wrap_tool_payload(call.name, payload),
                        }
                    )
                continue

            if (
                not heuristic_applied
                and not tools_used
                and needs_tools
                and plan.tools
            ):
                heuristic_applied = True
                ran = _run_named_tools(plan.tools)
                messages.append(
                    {
                        "role": "user",
                        "content": _wrap_tool_payload("heuristic_context", {"tools": ran}),
                    }
                )
                continue

            answer = (result.content or "").strip()
            if not answer:
                answer = "I don't have enough data in your TradeFix journal to determine that."
            return _finish(answer, True)
    except AiNotConfiguredError:
        return _finish(
            "AI is not configured on this server. Ask an administrator to set GROQ_API_KEY or OPENROUTER_API_KEY.",
            False,
            "not_configured",
        )
    except AiProviderError as exc:
        logger.exception("AI provider failed request_id=%s", request_id)
        if tools_used:
            answer = (
                "Something went wrong while analyzing your data after retrieving TradeFix statistics. "
                "Please try again."
            )
            return _finish(answer, False, exc.code)
        raise

    fallback_answer = "Something went wrong while analyzing your data. Please try again."
    return _finish(fallback_answer, False, "max_iterations")
