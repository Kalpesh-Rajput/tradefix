from __future__ import annotations

import re
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from app.services.ai.tools.filters import SESSION_ALIASES
from app.services.ai.tools.registry import ANALYTICS_TOOLS, RAG_TOOLS

_GREETING = re.compile(
    r"^\s*(hi|hello|hey|thanks|thank you|yo|good (morning|afternoon|evening))\b",
    re.I,
)


@dataclass
class HeuristicPlan:
    intent: str
    tools: list[tuple[str, dict]] = field(default_factory=list)


def _month_bounds(now: datetime, offset: int = 0) -> tuple[str, str]:
    year = now.year
    month = now.month + offset
    while month <= 0:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    last = monthrange(year, month)[1]
    end = datetime(year, month, last, 23, 59, 59, tzinfo=timezone.utc)
    return start.date().isoformat(), end.date().isoformat()


def extract_filters(question: str, now: datetime | None = None) -> dict:
    text = question.lower()
    now = now or datetime.now(timezone.utc)
    args: dict = {}
    if "this month" in text or "current month" in text:
        start, end = _month_bounds(now, 0)
        args["date_from"] = start
        args["date_to"] = end
    elif "last month" in text or "previous month" in text:
        start, end = _month_bounds(now, -1)
        args["date_from"] = start
        args["date_to"] = end
    elif "this week" in text:
        start = now - timedelta(days=now.weekday())
        args["date_from"] = start.date().isoformat()
        args["date_to"] = now.date().isoformat()
    elif "today" in text:
        args["date_from"] = now.date().isoformat()
        args["date_to"] = now.date().isoformat()

    symbol = re.search(r"\b(?:on|for|symbol)\s+([A-Z]{1,6})\b", question)
    if not symbol:
        symbol = re.search(r"\b([A-Z]{2,6})\b", question)
    if symbol:
        token = symbol.group(1)
        if token not in {"NY", "P", "L", "AI", "SQL", "RAG", "FOMO"}:
            args["symbol"] = token

    for alias, canonical in SESSION_ALIASES.items():
        if re.search(rf"\b{re.escape(alias)}\b", text):
            args["session"] = canonical
            break

    setup = re.search(r"\b(?:setup|strategy)\s+[\"']?([A-Za-z0-9 _-]{3,40})", question, re.I)
    if setup:
        args["setup"] = setup.group(1).strip(" ?.,")
    elif "breakout" in text:
        args["setup"] = "Breakout"

    if re.search(r"\blong(s)?\b", text):
        args["direction"] = "long"
    elif re.search(r"\bshort(s)?\b", text):
        args["direction"] = "short"
    return args


def quick_reply(question: str) -> str | None:
    """Instant answer for a greeting by itself. Anything after the greeting still uses tools."""
    text = (question or "").strip()
    if not text or len(text) >= 40 or not _GREETING.match(text):
        return None
    remainder = _GREETING.sub("", text, count=1).strip(" \t.,!?:;-")
    if remainder or looks_like_data_question(text):
        return None
    if re.match(r"^\s*(thanks|thank you)\b", text, re.I):
        return (
            "You're welcome. I can help you review win rate, setups, sessions, risk, and your journal. "
            "What do you want to look at?"
        )
    return (
        "Hello. I can help you review your trades, setups, sessions, risk, and journal. "
        "What do you want to look at?"
    )


def looks_like_news_question(question: str) -> bool:
    text = (question or "").lower().strip()
    if not text or (_GREETING.match(text) and len(text) < 40):
        return False
    if re.search(r"\b(news|headline|headlines|breaking|catalyst|fomc|cpi|nfp|earnings)\b", text):
        return True
    return any(phrase in text for phrase in ("what happened", "what's happening", "whats happening", "market update"))


def news_query(question: str) -> str:
    text = re.sub(r"\s+", " ", question or "").strip().rstrip("?")
    text = re.sub(r"^(?:please\s+)?(?:what(?:'s| is)|tell me|show me|give me|any)\s+", "", text, flags=re.I)
    text = re.sub(r"^(?:the\s+)?(?:latest|recent|current|today'?s)\s+", "", text, flags=re.I)
    text = re.sub(r"^(?:news|headlines?)\s+(?:on|about|regarding|related to)\s+", "", text, flags=re.I)
    text = re.sub(r"^(?:news|headlines?)\s+", "", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip(" ?.,")
    return (text or question.strip())[:160]


def looks_like_data_question(question: str) -> bool:
    text = question.lower().strip()
    if not text or _GREETING.match(text) and len(text) < 40:
        return False
    needles = (
        "pnl",
        "p&l",
        "profit",
        "loss",
        "win rate",
        "winrate",
        "expectancy",
        "drawdown",
        "streak",
        "setup",
        "session",
        "symbol",
        "tag",
        "journal",
        "mistake",
        "playbook",
        "trade",
        "performance",
        "compare",
        "why am i",
        "losing",
        "lose",
        "pattern",
        "time of day",
        "best time",
        "london",
        "new york",
        "asia",
    )
    if any(needle in text for needle in needles):
        return True
    return bool(re.search(r"\b(nq|es)\b", text))


def classify_question(question: str, now: datetime | None = None) -> HeuristicPlan:
    text = question.lower().strip()
    if not text or (_GREETING.match(text) and not looks_like_data_question(text)):
        return HeuristicPlan(intent="direct")

    filters = extract_filters(question, now=now)
    tools: list[tuple[str, dict]] = []
    stats = False
    rag = False

    if any(word in text for word in ("journal", "mistake", "fomo", "emotion", "hesitat", "revenge", "note")):
        rag = True
        tools.append(("search_user_journal", {"query": question}))
        if "note" in text or "comment" in text:
            tools.append(("search_user_trade_notes", {"query": question}))
    if "playbook" in text:
        rag = True
        tools.append(("get_playbook_context", {"query": question}))

    if "drawdown" in text or "streak" in text or "largest loss" in text or "largest win" in text:
        stats = True
        tools.append(("get_drawdown_statistics", dict(filters)))
    if "setup" in text or "breakout" in text or "best setup" in text:
        stats = True
        tools.append(("get_setup_statistics", dict(filters)))
    if (
        "session" in text
        or "time of day" in text
        or "best time" in text
        or "what time" in text
        or "which hour" in text
        or any(alias in text for alias in SESSION_ALIASES)
    ):
        stats = True
        tools.append(("get_session_statistics", dict(filters)))
    if "symbol" in text or filters.get("symbol") or re.search(r"\bon [A-Z]{2,6}\b", question):
        stats = True
        tools.append(("get_symbol_statistics", dict(filters)))
    if "tag" in text or "expectancy" in text:
        stats = True
        tools.append(("get_tag_statistics", dict(filters)))
    if "history" in text or "recent" in text or "losing trades" in text or "last trades" in text:
        stats = True
        tools.append(("get_trade_history", {**filters, "limit": 40}))
    if (
        "pnl" in text
        or "p&l" in text
        or "profit" in text
        or "win rate" in text
        or "winrate" in text
        or "performance" in text
        or "compare" in text
        or not tools
    ) and looks_like_data_question(question):
        stats = True
        tools.append(("get_trade_statistics", dict(filters)))

    if "why" in text or "pattern" in text or "losing" in text or "analyse" in text or "analyze" in text:
        stats = True
        rag = True
        names = {name for name, _ in tools}
        if "get_trade_statistics" not in names:
            tools.append(("get_trade_statistics", dict(filters)))
        if "get_setup_statistics" not in names:
            tools.append(("get_setup_statistics", dict(filters)))
        if "search_user_journal" not in names:
            tools.append(("search_user_journal", {"query": question}))
        if "search_user_trade_notes" not in names:
            tools.append(("search_user_trade_notes", {"query": question}))

    if "compare" in text and ("month" in text or "last month" in text):
        this_start, this_end = _month_bounds(now or datetime.now(timezone.utc), 0)
        last_start, last_end = _month_bounds(now or datetime.now(timezone.utc), -1)
        tools = [
            ("get_trade_statistics", {"date_from": this_start, "date_to": this_end}),
            ("get_trade_statistics", {"date_from": last_start, "date_to": last_end}),
        ]
        if "session" in text:
            tools.append(("get_session_statistics", {}))
        stats = True

    web = looks_like_news_question(question)
    if web:
        tools.append(("search_web", {"query": news_query(question)}))

    deduped: list[tuple[str, dict]] = []
    seen: set[tuple] = set()
    for name, args in tools:
        key = (name, tuple(sorted((k, str(v)) for k, v in args.items())))
        if key in seen:
            continue
        seen.add(key)
        deduped.append((name, args))

    if stats and rag:
        intent = "hybrid"
    elif rag and not stats:
        intent = "vector_search"
    elif any(name in {"get_trade_statistics", "get_trade_history"} for name, _ in deduped) and not (
        set(name for name, _ in deduped) - ANALYTICS_TOOLS
    ):
        intent = "analytics" if any(
            name
            in {
                "get_setup_statistics",
                "get_session_statistics",
                "get_symbol_statistics",
                "get_tag_statistics",
                "get_drawdown_statistics",
            }
            for name, _ in deduped
        ) else "sql"
    elif stats:
        intent = "analytics"
    else:
        intent = "direct"
    if intent == "analytics" and any(name in RAG_TOOLS for name, _ in deduped):
        intent = "hybrid"
    if web and intent == "direct":
        intent = "web_search"
    elif web and intent != "hybrid":
        intent = "hybrid"
    return HeuristicPlan(intent=intent, tools=deduped)
