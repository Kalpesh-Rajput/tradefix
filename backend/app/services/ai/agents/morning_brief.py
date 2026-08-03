import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.insight import InsightSeverity, InsightType
from app.models.watchlist import WatchlistItem
from app.services import stats_service
from app.services.ai.agents.base import BaseAgent
from app.services.ai.prompts import morning_brief_prompt


class MorningBriefAgent(BaseAgent):
    name = "morning_brief"
    display_name = "Morning Brief"
    insight_type = InsightType.morning_brief
    default_severity = InsightSeverity.info

    def gather_stats(self, db: Session, user_id: uuid.UUID) -> dict | None:
        analytics = stats_service.full_analytics(db, user_id)
        if analytics["overview"]["total_trades"] < 5:
            return None

        watchlist = db.scalars(select(WatchlistItem).where(WatchlistItem.user_id == user_id)).all()
        by_hour = analytics["by_hour"]
        worst_hour = min(by_hour, key=lambda b: b["win_rate"]) if by_hour else None
        top_setups = sorted(analytics["by_setup"], key=lambda s: s["win_rate_last_30d"], reverse=True)[:3]

        return {
            "watchlist": [w.symbol for w in watchlist] or ["(none added yet)"],
            "open_positions": stats_service.open_positions_summary(db, user_id) or ["(no open positions)"],
            "top_setups": top_setups or ["(no tagged setups yet)"],
            "worst_hour": worst_hour or "(not enough data)",
            "streak_type": analytics["overview"]["current_streak_type"],
            "streak_count": analytics["overview"]["current_streak"],
        }

    def build_prompt(self, stats: dict) -> str:
        return morning_brief_prompt(stats)
