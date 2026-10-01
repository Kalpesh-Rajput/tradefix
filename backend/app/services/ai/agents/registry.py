from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AgentTemplate:
    key: str
    name: str
    description: str
    category: str
    triggers: tuple[str, ...]
    reads: frozenset[str]
    writes: frozenset[str]
    implemented: bool = True
    coming_soon: bool = False


TEMPLATES: dict[str, AgentTemplate] = {
    "market_briefing": AgentTemplate(
        key="market_briefing",
        name="Market Sentiment Briefing",
        description="Analyze the markets you trade and generate a concise briefing before your trading session.",
        category="Trading Intelligence",
        triggers=("manual", "start_my_day"),
        reads=frozenset({"market", "news", "performance", "day_plan"}),
        writes=frozenset({"day_plan_briefing", "notebook_note"}),
    ),
    "trade_tagger": AgentTemplate(
        key="trade_tagger",
        name="Trade Auto-Tagger",
        description="Automatically analyze imported trades and suggest or apply meaningful tags.",
        category="Trading Journal",
        triggers=("manual", "after_import"),
        reads=frozenset({"trades"}),
        writes=frozenset({"setup_tags", "ai_tag_suggestions"}),
    ),
    "session_review": AgentTemplate(
        key="session_review",
        name="Session Review",
        description="Generate a structured review of one trading day from the trades, rules, and notes already logged.",
        category="Performance",
        triggers=("manual", "day_view", "after_session"),
        reads=frozenset({"trades", "rules", "playbooks", "notes", "recap"}),
        writes=frozenset({"daily_recap", "notebook_note"}),
    ),
}

COMING_SOON: tuple[AgentTemplate, ...] = (
    AgentTemplate("rule_guardian", "Rule Guardian", "Watch logged trades against your rules.", "Risk", (), frozenset(), frozenset(), False, True),
    AgentTemplate("tilt_detector", "Tilt Detector", "Notice revenge trading and loss streaks.", "Discipline", (), frozenset(), frozenset(), False, True),
    AgentTemplate("risk_guardian", "Risk Guardian", "Flag size and drawdown that break your plan.", "Risk", (), frozenset(), frozenset(), False, True),
    AgentTemplate("weekly_coach", "Weekly Performance Coach", "Summarize the week into one coaching note.", "Performance", (), frozenset(), frozenset(), False, True),
    AgentTemplate("playbook_auditor", "Playbook Auditor", "Compare executions with playbook rules.", "Trades", (), frozenset(), frozenset(), False, True),
    AgentTemplate("setup_discovery", "Setup Discovery Agent", "Find setups that keep showing up in the journal.", "Performance", (), frozenset(), frozenset(), False, True),
    AgentTemplate("prop_guardian", "Prop Firm Guardian", "Track drawdown against prop-firm limits.", "Risk", (), frozenset(), frozenset(), False, True),
    AgentTemplate("journal_insight", "Journal Insight Agent", "Connect mood and notes with results.", "Journal", (), frozenset(), frozenset(), False, True),
)


def get_template(key: str) -> AgentTemplate | None:
    return TEMPLATES.get(key)


def public_templates() -> list[dict]:
    rows = []
    for template in list(TEMPLATES.values()) + list(COMING_SOON):
        rows.append(
            {
                "key": template.key,
                "name": template.name,
                "description": template.description,
                "category": template.category,
                "triggers": list(template.triggers),
                "reads": sorted(template.reads),
                "writes": sorted(template.writes),
                "implemented": template.implemented,
                "coming_soon": template.coming_soon,
            }
        )
    return rows


DEFAULT_CONFIG: dict[str, dict] = {
    "market_briefing": {"symbols": [], "include_news": True, "include_events": True, "include_performance": True},
    "trade_tagger": {"mode": "suggest"},
    "session_review": {},
}


def clean_config(key: str, raw: dict | None) -> dict:
    base = dict(DEFAULT_CONFIG.get(key, {}))
    incoming = raw or {}
    if key == "market_briefing":
        symbols = []
        for symbol in incoming.get("symbols") or base["symbols"]:
            text = str(symbol).strip().upper()
            if text and text not in symbols:
                symbols.append(text[:16])
        base["symbols"] = symbols[:12]
        for flag in ("include_news", "include_events", "include_performance"):
            if flag in incoming:
                base[flag] = bool(incoming[flag])
    elif key == "trade_tagger":
        mode = str(incoming.get("mode") or base["mode"])
        base["mode"] = "apply" if mode == "apply" else "suggest"
    return base


ALLOWED_TRIGGERS = {
    "market_briefing": {"manual", "start_my_day"},
    "trade_tagger": {"manual", "after_import"},
    "session_review": {"manual", "day_view", "after_session"},
}


def clean_triggers(key: str, raw: list[str] | None) -> list[str]:
    allowed = ALLOWED_TRIGGERS.get(key, set())
    chosen = [item for item in (raw or []) if item in allowed]
    if "manual" in allowed and "manual" not in chosen:
        chosen.insert(0, "manual")
    return chosen
