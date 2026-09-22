from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

InsightCategory = Literal[
    "leak",
    "behavior",
    "edge",
    "rule",
    "change",
    "overtrading",
    "news",
    "early",
]
InsightConfidence = Literal["high", "medium", "early"]
MetricTone = Literal["pos", "neg", "neutral"]


class InsightMetric(BaseModel):
    label: str
    value: str
    tone: MetricTone | None = None


class InsightWhy(BaseModel):
    sample_size: int
    matching_trades: int
    losses: int | None = None
    loss_share: float | None = None
    narrative: str


class InsightTradeFilter(BaseModel):
    ids: list[str] | None = None
    setup_tag: str | None = None
    symbol: str | None = None
    session: str | None = None
    side: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    auto_flag: str | None = None
    has_rules_broken: bool | None = None


class InsightNewsItem(BaseModel):
    title: str
    url: str
    publisher: str | None = None
    published: str | None = None


class InsightCard(BaseModel):
    id: str
    category: InsightCategory
    confidence: InsightConfidence
    title: str
    explanation: str
    metrics: list[InsightMetric] = Field(default_factory=list)
    evidence: str
    why: InsightWhy
    trade_filter: InsightTradeFilter = Field(default_factory=InsightTradeFilter)
    ask_question: str
    primary_action_label: str
    suggested_rule: str | None = None
    news_items: list[InsightNewsItem] | None = None


class InsightSummary(BaseModel):
    text: str
    ask_question: str = "Ask about my performance"
    attention_count: int = 0


class InsightFocus(BaseModel):
    title: str
    why: str
    suggested_action: str
    suggested_rule: str
    ask_question: str
    trade_filter: InsightTradeFilter | None = None


class InsightWeekly(BaseModel):
    date_from: str
    date_to: str
    trades: int
    win_rate: float | None = None
    pnl: float = 0
    performance_r: float | None = None
    best_setup: str | None = None
    biggest_leak: str | None = None
    best_session: str | None = None
    rule_adherence: float | None = None
    biggest_improvement: str | None = None
    main_focus: str | None = None


class AiInsightsFeed(BaseModel):
    generated_at: datetime
    trades_analysed: int
    enough_data: bool
    summary: InsightSummary | None = None
    insights: list[InsightCard] = Field(default_factory=list)
    focus: InsightFocus | None = None
    weekly: InsightWeekly | None = None
