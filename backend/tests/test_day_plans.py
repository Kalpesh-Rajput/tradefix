from datetime import date
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.services.day_plans_service import seed_game_plan_labels
from app.services.progress_rule_engine import ConfigSnapshot, ManualRuleSnapshot

client = TestClient(app)


def test_day_plans_require_auth():
    assert client.get("/api/day-plans/by-day?account_id=00000000-0000-0000-0000-000000000001&date=2026-09-16").status_code == 401
    assert client.patch("/api/day-plans/00000000-0000-0000-0000-000000000001", json={"briefing": "x"}).status_code == 401
    assert client.post("/api/day-plans/00000000-0000-0000-0000-000000000001/items", json={"label": "Gym"}).status_code == 401


def test_seed_game_plan_copies_enabled_rules_for_weekday():
    config = ConfigSnapshot(
        active_days=("mon", "tue", "wed", "thu", "fri"),
        trading_hours_enabled=True,
        trading_start_time="09:30",
        trading_end_time="16:00",
        start_day_enabled=True,
        start_day_time="14:00",
        stop_loss_required=True,
        max_loss_per_day_enabled=True,
        manual_rules=(
            ManualRuleSnapshot(id=uuid4(), name="Go to Gym", schedule=("mon", "wed", "fri"), sort_order=0, is_active=True),
            ManualRuleSnapshot(id=uuid4(), name="Weekend only", schedule=("sat",), sort_order=1, is_active=True),
        ),
    )
    labels = seed_game_plan_labels(config, date(2026, 9, 16))  # Wednesday
    assert "Trading hours 09:30–16:00" in labels
    assert "Start my day by 14:00" in labels
    assert "Input stop loss for all trades" in labels
    assert "Net max loss / day" in labels
    assert "Go to Gym" in labels
    assert "Weekend only" not in labels


def test_seed_game_plan_empty_without_config():
    assert seed_game_plan_labels(None, date(2026, 9, 16)) == []
