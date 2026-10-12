"""Optional Trade View advance filters for dashboard analytics and the calendar."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from fastapi import HTTPException, Query, status
from pydantic import ValidationError

from app.schemas.trade_export import TradeExportFilters


@dataclass(frozen=True)
class DashboardFilterQuery:
    filters: TradeExportFilters | None
    pnl_mode: str


def _iso_day(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def _plain(name: str, value: str) -> str:
    text = value.strip()
    if any(ord(char) < 32 for char in text):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid {name}.")
    return text


def journal_filters_active(filters: TradeExportFilters) -> bool:
    return any(
        (
            filters.status != "all",
            filters.asset_type,
            filters.side,
            filters.setup_tag,
            filters.symbol,
            filters.session,
            filters.holding,
            filters.pnl,
            filters.fees,
            filters.risk,
            filters.roi,
            filters.rating,
            filters.r_multiple,
            filters.weekday,
            filters.mood,
            filters.emotion,
            filters.journal,
            filters.rules,
        )
    )


def build_dashboard_filters(
    *,
    adv_status: str = "all",
    adv_asset_type: str = "",
    adv_side: str = "",
    adv_setup_tag: str = "",
    adv_symbol: str = "",
    adv_session: str = "",
    adv_holding: str = "",
    adv_pnl: str = "",
    adv_fees: str = "",
    adv_risk: str = "",
    adv_roi: str = "",
    adv_rating: str = "",
    adv_r_multiple: str = "",
    adv_weekday: str = "",
    adv_mood: str = "",
    adv_emotion: str = "",
    adv_journal: str = "",
    adv_rules: str = "",
    adv_today: str = "",
    pnl_mode: str = "net",
) -> DashboardFilterQuery:
    mode = pnl_mode.strip().lower()
    if mode not in {"net", "gross"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid pnl_mode.")
    today = adv_today.strip()
    if today and not _iso_day(today):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid adv_today.")
    try:
        filters = TradeExportFilters.model_validate(
            {
                "status": adv_status.strip() or "all",
                "asset_type": adv_asset_type.strip(),
                "side": adv_side.strip(),
                "setup_tag": _plain("setup", adv_setup_tag),
                "symbol": _plain("symbol", adv_symbol),
                "session": _plain("session", adv_session),
                "holding": adv_holding.strip(),
                "pnl": adv_pnl.strip(),
                "fees": adv_fees.strip(),
                "risk": adv_risk.strip(),
                "roi": adv_roi.strip(),
                "rating": adv_rating.strip(),
                "r_multiple": adv_r_multiple.strip(),
                "weekday": adv_weekday.strip(),
                "mood": _plain("mood", adv_mood),
                "emotion": _plain("emotion", adv_emotion),
                "journal": adv_journal.strip(),
                "rules": adv_rules.strip(),
                "today": today or None,
            }
        )
    except ValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid advance filter.") from exc
    if not journal_filters_active(filters):
        return DashboardFilterQuery(filters=None, pnl_mode=mode)
    return DashboardFilterQuery(filters=filters, pnl_mode=mode)


def dashboard_filter_query(
    adv_status: str = Query("all", max_length=16),
    adv_asset_type: str = Query("", max_length=16),
    adv_side: str = Query("", max_length=16),
    adv_setup_tag: str = Query("", max_length=120),
    adv_symbol: str = Query("", max_length=64),
    adv_session: str = Query("", max_length=64),
    adv_holding: str = Query("", max_length=16),
    adv_pnl: str = Query("", max_length=16),
    adv_fees: str = Query("", max_length=16),
    adv_risk: str = Query("", max_length=16),
    adv_roi: str = Query("", max_length=16),
    adv_rating: str = Query("", max_length=16),
    adv_r_multiple: str = Query("", max_length=16),
    adv_weekday: str = Query("", max_length=2),
    adv_mood: str = Query("", max_length=120),
    adv_emotion: str = Query("", max_length=120),
    adv_journal: str = Query("", max_length=16),
    adv_rules: str = Query("", max_length=16),
    adv_today: str = Query("", max_length=10),
    pnl_mode: str = Query("net", max_length=8),
) -> DashboardFilterQuery:
    return build_dashboard_filters(
        adv_status=adv_status,
        adv_asset_type=adv_asset_type,
        adv_side=adv_side,
        adv_setup_tag=adv_setup_tag,
        adv_symbol=adv_symbol,
        adv_session=adv_session,
        adv_holding=adv_holding,
        adv_pnl=adv_pnl,
        adv_fees=adv_fees,
        adv_risk=adv_risk,
        adv_roi=adv_roi,
        adv_rating=adv_rating,
        adv_r_multiple=adv_r_multiple,
        adv_weekday=adv_weekday,
        adv_mood=adv_mood,
        adv_emotion=adv_emotion,
        adv_journal=adv_journal,
        adv_rules=adv_rules,
        adv_today=adv_today,
        pnl_mode=pnl_mode,
    )
