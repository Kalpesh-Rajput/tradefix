import uuid

from sqlalchemy.orm import Session

from app.models.insight import InsightSeverity, InsightType
from app.services import stats_service
from app.services.ai.agents.base import BaseAgent
from app.services.ai.prompts import journal_pulse_prompt


class JournalPulseAgent(BaseAgent):
    """Reads the trader's own mood check-ins/notes -- a local stand-in for
    SuperTrader's "The Crowd" (external social sentiment), which is out of
    scope since this MVP has no external data sources."""

    name = "journal_pulse"
    display_name = "Journal Pulse"
    insight_type = InsightType.journal_pulse
    default_severity = InsightSeverity.info

    def gather_stats(self, db: Session, user_id: uuid.UUID) -> dict | None:
        analytics = stats_service.full_analytics(db, user_id)
        mood_data = analytics["mood_vs_pnl"]
        if len(mood_data) < 2:
            return None
        return {"mood_vs_pnl": mood_data}

    def build_prompt(self, stats: dict) -> str:
        return journal_pulse_prompt(stats)
