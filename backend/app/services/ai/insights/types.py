from __future__ import annotations

from dataclasses import dataclass, field


MIN_TRADES_OVERALL = 10
MIN_STRONG = 8
MIN_EARLY = 4
MAX_INSIGHTS = 5
STALE_HOURS = 6


@dataclass
class Candidate:
    category: str
    detector: str
    title: str
    explanation: str
    evidence: str
    why_narrative: str
    n: int
    matching_trades: int
    losses: int
    loss_share: float | None
    metrics: list[dict]
    trade_ids: list[str]
    trade_filter: dict
    ask_question: str
    primary_action_label: str
    financial: float = 0.0
    recency: float = 0.0
    behavioral: float = 0.0
    combo_label: str = ""
    suggested_rule: str | None = None
    suggested_action: str | None = None
    news_items: list[dict] | None = None
    extra: dict = field(default_factory=dict)
