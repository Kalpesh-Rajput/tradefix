import uuid

from sqlalchemy.orm import Session

from app.models.insight import InsightSeverity, InsightType
from app.services import stats_service
from app.services.ai.agents.base import BaseAgent
from app.services.ai.prompts import pattern_scout_prompt


class PatternScoutAgent(BaseAgent):
    name = "pattern_scout"
    display_name = "Pattern Scout"
    insight_type = InsightType.pattern_scout
    default_severity = InsightSeverity.positive

    def gather_stats(self, db: Session, user_id: uuid.UUID) -> dict | None:
        analytics = stats_service.full_analytics(db, user_id)
        setups = [s for s in analytics["by_setup"] if s["trades"] >= 5]
        if not setups:
            return None
        return {"setups": setups}

    def build_prompt(self, stats: dict) -> str:
        return pattern_scout_prompt(stats)
