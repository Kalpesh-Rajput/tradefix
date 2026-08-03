from app.services.ai.agents.hot_take import HotTakeAgent
from app.services.ai.agents.journal_pulse import JournalPulseAgent
from app.services.ai.agents.morning_brief import MorningBriefAgent
from app.services.ai.agents.pattern_scout import PatternScoutAgent
from app.services.ai.agents.risk_contribution import RiskContributionAgent

AGENT_REGISTRY = {
    "morning_brief": MorningBriefAgent(),
    "pattern_scout": PatternScoutAgent(),
    "risk_contribution": RiskContributionAgent(),
    "hot_take": HotTakeAgent(),
    "journal_pulse": JournalPulseAgent(),
}

__all__ = ["AGENT_REGISTRY"]
