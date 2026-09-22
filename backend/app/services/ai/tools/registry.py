from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from app.services.ai.tools import analytics, search, web
from app.services.ai.tools.context import ToolContext
from app.services.ai.tools.filters import sanitize_tool_args

logger = logging.getLogger(__name__)

Handler = Callable[[ToolContext, dict], dict]

_FILTER_PROPS = {
    "date_from": {"type": "string", "description": "ISO date or datetime inclusive start (YYYY-MM-DD)."},
    "date_to": {"type": "string", "description": "ISO date or datetime inclusive end (YYYY-MM-DD)."},
    "symbol": {"type": "string", "description": "Instrument symbol such as NQ or ES."},
    "direction": {"type": "string", "enum": ["long", "short"], "description": "Trade direction."},
    "setup": {"type": "string", "description": "Setup or strategy name."},
    "session": {"type": "string", "description": "Session name such as Asia, London, NY, Overlap."},
    "tags": {
        "type": "array",
        "items": {"type": "string"},
        "description": "User-defined setup or emotion tags.",
    },
}


def _tool(name: str, description: str, properties: dict, required: list[str] | None = None) -> dict:
    schema: dict[str, Any] = {
        "type": "object",
        "properties": properties,
        "additionalProperties": False,
    }
    if required:
        schema["required"] = required
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": schema,
        },
    }


TOOL_SCHEMAS: list[dict] = [
    _tool("get_trade_statistics", "Overall trade statistics for the authenticated user.", _FILTER_PROPS),
    _tool(
        "get_trade_history",
        "Recent closed trades with only the fields needed for analysis.",
        {**_FILTER_PROPS, "limit": {"type": "integer", "minimum": 1, "maximum": 100}},
    ),
    _tool("get_setup_statistics", "Performance grouped by setup/strategy.", _FILTER_PROPS),
    _tool("get_session_statistics", "Performance grouped by Asia, London, Overlap, NY, and Off sessions.", _FILTER_PROPS),
    _tool("get_symbol_statistics", "Performance grouped by symbol.", _FILTER_PROPS),
    _tool("get_tag_statistics", "Performance grouped by setup and emotion tags.", _FILTER_PROPS),
    _tool("get_drawdown_statistics", "Drawdown, streaks, largest win and largest loss.", _FILTER_PROPS),
    _tool(
        "search_user_journal",
        "Semantic or keyword search over the user's journal, daily reviews, and check-ins.",
        {"query": {"type": "string", "description": "Search text."}},
        ["query"],
    ),
    _tool(
        "search_user_trade_notes",
        "Search trade notes, voice transcripts, and trade comments.",
        {"query": {"type": "string", "description": "Search text."}},
        ["query"],
    ),
    _tool(
        "get_playbook_context",
        "Retrieve the user's playbooks and related strategy rules.",
        {"query": {"type": "string", "description": "Optional playbook name or topic."}},
    ),
    _tool(
        "search_web",
        "Search recent public news for market headlines, catalysts, and what is happening outside the journal. Use when the user asks about news.",
        {"query": {"type": "string", "description": "Short news search, such as 'Fed rates' or 'Nasdaq'."}},
        ["query"],
    ),
]

HANDLERS: dict[str, Handler] = {
    "get_trade_statistics": analytics.get_trade_statistics,
    "get_trade_history": analytics.get_trade_history,
    "get_setup_statistics": analytics.get_setup_statistics,
    "get_session_statistics": analytics.get_session_statistics,
    "get_symbol_statistics": analytics.get_symbol_statistics,
    "get_tag_statistics": analytics.get_tag_statistics,
    "get_drawdown_statistics": analytics.get_drawdown_statistics,
    "search_user_journal": search.search_user_journal,
    "search_user_trade_notes": search.search_user_trade_notes,
    "get_playbook_context": search.get_playbook_context,
    "search_web": web.search_web,
}

ANALYTICS_TOOLS = {
    "get_trade_statistics",
    "get_trade_history",
    "get_setup_statistics",
    "get_session_statistics",
    "get_symbol_statistics",
    "get_tag_statistics",
    "get_drawdown_statistics",
}
RAG_TOOLS = {"search_user_journal", "search_user_trade_notes", "get_playbook_context"}
WEB_TOOLS = {"search_web"}


def resolve_tool_call(name: str, raw_args: dict | None) -> tuple[str, dict]:
    """Map invented tool names from the model onto the real TradeFix tools."""
    args = dict(raw_args or {})
    metric = str(args.pop("metric", "") or "").lower().replace("-", " ").replace("_", " ")
    key = (name or "").strip().lower().replace("-", "_")
    blob = f"{key.replace('_', ' ')} {metric}"
    if any(token in blob for token in ("time of day", "best time", "session", "which hour", "what time")):
        return "get_session_statistics", args
    if "setup" in blob or "strategy" in blob:
        return "get_setup_statistics", args
    if "symbol" in blob:
        return "get_symbol_statistics", args
    if "drawdown" in blob or "streak" in blob:
        return "get_drawdown_statistics", args
    if "news" in blob or "headline" in blob:
        query = str(args.get("query") or metric or name).strip()
        return "search_web", {"query": query}
    if "journal" in blob or "note" in blob:
        return "search_user_journal", {"query": str(args.get("query") or metric or "journal")}
    if key in HANDLERS:
        return key, args
    return "get_trade_statistics", args


def execute_tool(name: str, raw_args: dict | None, ctx: ToolContext) -> dict:
    name, raw_args = resolve_tool_call(name, raw_args)
    handler = HANDLERS.get(name)
    if handler is None:
        return {"error": True, "message": f"Unknown tool: {name}"}
    args = sanitize_tool_args(raw_args)
    try:
        result = handler(ctx, args)
    except Exception:
        logger.exception("AI tool %s failed", name)
        return {"error": True, "message": f"{name} failed. Results from this tool are unavailable."}
    if not isinstance(result, dict):
        return {"error": True, "message": f"{name} returned an invalid payload."}
    return result
