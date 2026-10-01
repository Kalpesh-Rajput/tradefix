"""Pure agent decisions. Numbers and tags come from TradeFix records, not free-form model text."""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

CONFIDENCE_RANK = {"high": 3, "medium": 2, "low": 1}
_NUMBER = re.compile(r"-?\d+(?:\.\d+)?")


class OutputRejected(Exception):
    """The run must be saved as failed and must not write user data."""


class AgentInactive(Exception):
    """A paused agent must not start a run."""


def assert_active(status: str) -> None:
    if status != "active":
        raise AgentInactive("This agent is paused.")


def parse_model_json(raw: str | None) -> dict | None:
    text = (raw or "").strip()
    if not text:
        return None
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            parsed = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return parsed if isinstance(parsed, dict) else None


def grounded_summary(summary: str, evidence_blob: str, fallback: str) -> tuple[str, list[str]]:
    warnings: list[str] = []
    cleaned = " ".join((summary or "").split())
    if not cleaned:
        return fallback, warnings
    for number in _NUMBER.findall(cleaned):
        if number not in evidence_blob and number.lstrip("-") not in evidence_blob:
            warnings.append("The narrative was replaced because it cited a number that is not in the journal.")
            return fallback, warnings
    return cleaned, warnings


def drop_empty_findings(findings: list[dict]) -> list[dict]:
    kept: list[dict] = []
    for finding in findings:
        evidence = [str(item).strip() for item in (finding.get("evidence") or []) if str(item).strip()]
        actions = finding.get("actions") or []
        if not evidence or not actions:
            continue
        kept.append({**finding, "evidence": evidence})
    return kept


def hold_seconds(opened_at: datetime | None, closed_at: datetime | None) -> int | None:
    if opened_at is None or closed_at is None:
        return None
    return max(0, int((closed_at - opened_at).total_seconds()))


def format_hold(seconds: int | None) -> str | None:
    if seconds is None:
        return None
    minutes, secs = divmod(seconds, 60)
    if minutes >= 60:
        hours, minutes = divmod(minutes, 60)
        return f"{hours}h {minutes}m"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def propose_tags(trade: dict, catalog: list[str], instructions: str) -> list[dict]:
    """Suggest tags that already exist, plus a session or playbook name taken from the trade itself."""
    existing = {_norm(tag) for tag in trade.get("tags") or [] if tag}
    catalog_by_norm = {_norm(tag): tag for tag in catalog if tag}
    suggestions: list[dict] = []

    def add(tag: str, confidence: str, reason: str) -> None:
        label = catalog_by_norm.get(_norm(tag), tag).strip()
        if not label or _norm(label) in existing or any(_norm(item["tag"]) == _norm(label) for item in suggestions):
            return
        known = _norm(label) in catalog_by_norm
        if not known and confidence != "high":
            return
        suggestions.append({"tag": label, "confidence": confidence if known or confidence == "high" else "medium", "reason": reason})

    session = (trade.get("session") or "").strip()
    if session:
        add(session, "high", f"Session is {session}.")

    playbook = (trade.get("playbook") or "").strip()
    if playbook:
        add(playbook, "high", f"Linked playbook is {playbook}.")

    setup = (trade.get("setup") or "").strip()
    if setup:
        add(setup, "high", f"Setup recorded on the trade is {setup}.")

    seconds = trade.get("hold_seconds")
    hold = format_hold(seconds)
    if seconds is not None and seconds <= 5 * 60:
        match = next((catalog_by_norm[key] for key in catalog_by_norm if "scalp" in key), None)
        if match:
            add(match, "high", f"Hold time is {hold}.")
    elif seconds is not None and seconds >= 4 * 3600:
        match = next((catalog_by_norm[key] for key in catalog_by_norm if "swing" in key), None)
        if match:
            add(match, "medium", f"Hold time is {hold}.")

    notes = (trade.get("notes") or "").lower()
    focus = (instructions or "").lower()
    for tag in catalog:
        token = _norm(tag)
        if len(token) < 4:
            continue
        if token in notes or (token in focus and token in notes):
            add(tag, "medium", "The trade note uses this tag's wording.")

    suggestions.sort(key=lambda item: CONFIDENCE_RANK.get(item["confidence"], 0), reverse=True)
    return suggestions[:3]


def split_tag_modes(suggestions: list[dict], mode: str) -> tuple[list[dict], list[dict]]:
    """Apply mode writes only high-confidence tags. Everything else stays a suggestion."""
    if mode != "apply":
        return [], suggestions
    apply = [item for item in suggestions if item["confidence"] == "high"]
    suggest = [item for item in suggestions if item["confidence"] != "high"]
    return apply, suggest


def accept_suggestion(setup_tags: list[str], suggestions: list[dict], tag: str) -> tuple[list[str], list[dict]]:
    match = next((item for item in suggestions if _norm(item.get("tag", "")) == _norm(tag)), None)
    if match is None:
        return list(setup_tags), list(suggestions)
    tags = list(setup_tags)
    if not any(_norm(existing) == _norm(match["tag"]) for existing in tags):
        tags.append(match["tag"])
    remaining = [item for item in suggestions if _norm(item.get("tag", "")) != _norm(tag)]
    return tags, remaining


def reject_suggestion(suggestions: list[dict], tag: str) -> list[dict]:
    return [item for item in suggestions if _norm(item.get("tag", "")) != _norm(tag)]


def session_facts(trades: list[dict]) -> dict[str, Any]:
    count = len(trades)
    pnl_values = [float(trade["pnl"]) for trade in trades if trade.get("pnl") is not None]
    net = round(sum(pnl_values), 2) if pnl_values else 0.0
    winners = sum(1 for value in pnl_values if value > 0)
    decided = len(pnl_values)
    violated = [trade for trade in trades if trade.get("rules_broken")]
    with_playbook = [trade for trade in trades if trade.get("playbook")]
    adherence = f"{count - len(violated)} of {count} trades had no recorded rule violation" if count else "No trades"
    playbook = f"{len(with_playbook)} of {count} trades are linked to a playbook" if count else "No trades"
    win_rate = round((winners / decided) * 100, 1) if decided else None
    return {
        "trade_count": count,
        "net_pnl": net,
        "win_rate": win_rate,
        "violations": len(violated),
        "violation_ids": [trade["id"] for trade in violated],
        "adherence": adherence,
        "playbook": playbook,
        "playbook_ids": [trade["id"] for trade in with_playbook],
    }


def money(value: float) -> str:
    sign = "-" if value < 0 else ""
    return f"{sign}${abs(value):,.2f}"
