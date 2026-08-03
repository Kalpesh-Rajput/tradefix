import uuid

from sqlalchemy.orm import Session

from app.models.insight import InsightSeverity, InsightType
from app.services import stats_service
from app.services.ai.agents.base import BaseAgent
from app.services.ai.prompts import risk_contribution_prompt


class RiskContributionAgent(BaseAgent):
    name = "risk_contribution"
    display_name = "Risk Contribution"
    insight_type = InsightType.risk_contribution
    default_severity = InsightSeverity.warning

    def gather_stats(self, db: Session, user_id: uuid.UUID) -> dict | None:
        overview = stats_service.overview_stats(db, user_id)
        if overview["total_trades"] < 5:
            return None

        concentration = stats_service.position_concentration(db, user_id)
        streak_info = stats_service.recent_streak_info(db, user_id)

        return {
            "concentration": concentration or ["(no open positions)"],
            "consecutive_losses": streak_info["consecutive_losses"],
            "worst_day_pnl": overview["worst_day_pnl"],
        }

    def build_prompt(self, stats: dict) -> str:
        return risk_contribution_prompt(stats)
