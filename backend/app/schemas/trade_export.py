import uuid
from typing import Literal

from pydantic import BaseModel, Field

ExportFormat = Literal["csv", "xlsx", "xml"]
ExportScope = Literal["filtered", "all", "custom"]
PnlDisplayMode = Literal["net", "gross"]
StatusTab = Literal["all", "open", "closed"]
HoldingFilter = Literal["", "intraday", "multiday"]
PnlFilter = Literal["", "profit", "loss", "breakeven"]
SignFilter = Literal["", "positive", "negative"]
PresenceFilter = Literal["", "with", "without"]
RatingFilter = Literal["", "1", "2", "3", "4", "5", "unrated"]
RMultipleFilter = Literal["", "positive", "negative", "none"]
WeekdayFilter = Literal["", "0", "1", "2", "3", "4", "5", "6"]
JournalFilter = Literal["", "journaled", "unjournaled"]
RulesFilter = Literal["", "broken", "clean"]
AssetFilter = Literal["", "stock", "option", "future", "forex", "crypto"]
SideFilter = Literal["", "long", "short"]


class TradeExportFilters(BaseModel):
    """Same filter set the Trade View applies before it renders rows."""

    account_id: uuid.UUID | None = None
    search: str = Field(default="", max_length=200)
    date_from: str | None = Field(default=None, max_length=10)
    date_to: str | None = Field(default=None, max_length=10)
    status: StatusTab = "all"
    asset_type: AssetFilter = ""
    side: SideFilter = ""
    setup_tag: str = Field(default="", max_length=120)
    symbol: str = Field(default="", max_length=64)
    session: str = Field(default="", max_length=64)
    holding: HoldingFilter = ""
    pnl: PnlFilter = ""
    fees: PresenceFilter = ""
    risk: PresenceFilter = ""
    roi: SignFilter = ""
    rating: RatingFilter = ""
    r_multiple: RMultipleFilter = ""
    weekday: WeekdayFilter = ""
    mood: str = Field(default="", max_length=120)
    emotion: str = Field(default="", max_length=120)
    journal: JournalFilter = ""
    rules: RulesFilter = ""
    ids: str = Field(default="", max_length=8000)
    auto_flag: str = Field(default="", max_length=80)
    today: str | None = Field(default=None, max_length=10)


class TradeExportCountRequest(BaseModel):
    scope: ExportScope = "filtered"
    pnl_display_mode: PnlDisplayMode = "net"
    filters: TradeExportFilters = Field(default_factory=TradeExportFilters)


class TradeExportRequest(TradeExportCountRequest):
    format: ExportFormat = "csv"
    columns: list[str] = Field(default_factory=list, max_length=32)
