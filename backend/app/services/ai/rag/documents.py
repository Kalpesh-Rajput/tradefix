from __future__ import annotations

import json
from datetime import date, datetime

from app.models.daily_checkin import DailyCheckin
from app.models.daily_recap import DailyRecap
from app.models.day_note import DayNote
from app.models.mentor import TradeComment
from app.models.mood import MoodCheckin
from app.models.playbook import Playbook
from app.models.trade import Trade

JOURNAL_TYPES = ("day_note", "daily_recap", "daily_checkin", "mood_checkin")
TRADE_NOTE_TYPES = ("trade_note", "trade_comment")
PLAYBOOK_TYPES = ("playbook",)


def _fmt_date(value: date | datetime | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    return value.isoformat()


def _clip(text: str | None, limit: int = 4000) -> str:
    value = (text or "").strip()
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def day_note_document(note: DayNote) -> tuple[str, dict] | None:
    content = _clip(note.content)
    if not content:
        return None
    body = f"Day journal ({_fmt_date(note.date)}):\n{content}"
    meta = {
        "document_type": "journal",
        "date": _fmt_date(note.date),
        "account_id": str(note.account_id),
        "source_label": "Day journal",
    }
    return body, meta


def recap_document(recap: DailyRecap) -> tuple[str, dict] | None:
    parts = []
    if recap.day_mood:
        parts.append(f"Mood: {getattr(recap.day_mood, 'value', recap.day_mood)}")
    if recap.best_decision:
        parts.append(f"Best decision: {_clip(recap.best_decision, 1200)}")
    if recap.reflection:
        parts.append(f"Reflection: {_clip(recap.reflection, 2000)}")
    work_on = recap.work_on or []
    if work_on:
        parts.append("Work on: " + ", ".join(str(item) for item in work_on if item))
    if not parts:
        return None
    body = f"Daily review ({_fmt_date(recap.date)}):\n" + "\n".join(parts)
    meta = {
        "document_type": "daily_review",
        "date": _fmt_date(recap.date),
        "account_id": str(recap.account_id),
        "source_label": "Daily review",
    }
    return body, meta


def checkin_document(row: DailyCheckin) -> tuple[str, dict] | None:
    parts = []
    if row.focus_setup:
        parts.append(f"Focus setup: {row.focus_setup}")
    if row.goal_note:
        parts.append(f"Goal: {_clip(row.goal_note, 1200)}")
    if row.evening_note:
        parts.append(f"Evening note: {_clip(row.evening_note, 1200)}")
    if row.followed:
        parts.append(f"Followed plan: {row.followed}")
    if not parts:
        return None
    body = f"Daily check-in ({_fmt_date(row.date)}):\n" + "\n".join(parts)
    meta = {
        "document_type": "checkin",
        "date": _fmt_date(row.date),
        "source_label": "Daily check-in",
    }
    return body, meta


def mood_document(row: MoodCheckin) -> tuple[str, dict] | None:
    notes = _clip(row.notes)
    if not notes and row.mood_score is None:
        return None
    body = f"Mood check-in ({_fmt_date(row.date)}): score {row.mood_score}/5"
    if notes:
        body += f"\nNotes: {notes}"
    meta = {
        "document_type": "mood",
        "date": _fmt_date(row.date),
        "source_label": "Mood check-in",
    }
    return body, meta


def trade_note_document(trade: Trade) -> tuple[str, dict] | None:
    notes = _clip(trade.notes)
    transcript = _clip(trade.voice_transcript)
    if not notes and not transcript:
        return None
    opened = trade.opened_at
    date_s = opened.date().isoformat() if opened else None
    lines = [
        f"Trade: {trade.symbol}",
        f"Date: {date_s or 'unknown'}",
        f"Setup: {trade.setup_tag or 'n/a'}",
        f"Session: {trade.session or 'n/a'}",
        f"P&L: {float(trade.pnl) if trade.pnl is not None else 'n/a'}",
    ]
    if trade.emotion_tags:
        lines.append("Emotion: " + ", ".join(str(tag) for tag in trade.emotion_tags))
    if trade.rules_broken:
        lines.append("Mistake: " + ", ".join(str(tag) for tag in trade.rules_broken))
    if notes:
        lines.append(f"Notes: {notes}")
    if transcript:
        lines.append(f"Voice transcript: {transcript}")
    meta = {
        "document_type": "trade_note",
        "trade_id": str(trade.id),
        "date": date_s,
        "symbol": trade.symbol,
        "session": trade.session,
        "tags": list(trade.setup_tags or []) + list(trade.emotion_tags or []),
        "source_label": f"{trade.symbol} {date_s or ''}".strip(),
    }
    return "\n".join(lines), meta


def trade_comment_document(comment: TradeComment, trade: Trade | None = None) -> tuple[str, dict] | None:
    body_text = _clip(comment.body)
    if not body_text:
        return None
    symbol = trade.symbol if trade else "trade"
    body = f"Trade comment on {symbol}:\n{body_text}"
    meta = {
        "document_type": "trade_comment",
        "trade_id": str(comment.trade_id),
        "date": comment.created_at.date().isoformat() if comment.created_at else None,
        "symbol": trade.symbol if trade else None,
        "source_label": f"Comment on {symbol}",
    }
    return body, meta


def playbook_document(playbook: Playbook) -> tuple[str, dict] | None:
    parts = [f"Playbook: {playbook.name}"]
    if playbook.description:
        parts.append(_clip(playbook.description, 1500))
    rules = playbook.rules or {}
    if rules:
        parts.append("Rules: " + _clip(json.dumps(rules, default=str), 2000))
    checklist = playbook.checklist or []
    labels = []
    for item in checklist:
        if isinstance(item, dict):
            labels.append(str(item.get("label") or ""))
        else:
            labels.append(str(item))
    labels = [label for label in labels if label.strip()]
    if labels:
        parts.append("Checklist: " + ", ".join(labels[:20]))
    body = "\n".join(parts)
    if len(body.strip()) <= len("Playbook: "):
        return None
    meta = {
        "document_type": "playbook",
        "tags": list(playbook.tags or []),
        "source_label": playbook.name,
    }
    return body, meta
