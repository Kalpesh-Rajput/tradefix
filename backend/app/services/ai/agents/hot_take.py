import uuid

from sqlalchemy.orm import Session

from app.models.insight import InsightSeverity, InsightType
from app.services import stats_service
from app.services.ai.agents.base import BaseAgent
from app.services.ai.prompts import hot_take_prompt


class HotTakeAgent(BaseAgent):
    name = "hot_take"
    display_name = "Hot Take"
    insight_type = InsightType.hot_take
    default_severity = InsightSeverity.info

    def gather_stats(self, db: Session, user_id: uuid.UUID) -> dict | None:
        analytics = stats_service.full_analytics(db, user_id)
        setups = [s for s in analytics["by_setup"] if s["trades"] >= 3]
        if analytics["overview"]["total_trades"] < 10 or not setups:
            return None

        best_setup = max(setups, key=lambda s: s["pnl"])
        worst_setup = min(setups, key=lambda s: s["pnl"])

        return {
            "overview": analytics["overview"],
            "best_setup": best_setup,
            "worst_setup": worst_setup,
        }

    def build_prompt(self, stats: dict) -> str:
        return hot_take_prompt(stats)
