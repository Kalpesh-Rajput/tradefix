from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.schemas.dashboard_analytics import DashboardPerformance
from app.services.dashboard_analytics import build_performance


def _trade(**overrides):
    opened = datetime(2026, 10, 2, 15, 30, tzinfo=timezone.utc)  # Friday 15:30 UTC
    base = dict(
        pnl=100.0,
        fees=0.0,
        symbol="XAUUSD",
        opened_at=opened,
        closed_at=opened,
        rules_broken=[],
        strategy_name="Breakout",
        session="London",
        trade_type="Day",
        side=SimpleNamespace(value="long"),
        entry_timeframe="15m",
        analysis_timeframe=None,
        entry_condition="Break of structure",
        exit_condition="Target hit",
        mood=None,
        extra={},
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_empty_performance_has_no_fake_rates():
    data = build_performance([], "UTC")
    assert data["has_trades"] is False
    assert all(day["win_rate"] is None and day["pnl"] is None for day in data["weekly_win_rate"])
    assert data["weekly_win_rate"][0]["day"] == "Sun"
    assert data["weekly_win_rate"][-1]["day"] == "Sat"
    assert all(hour["trades"] == 0 and hour["win_rate"] is None for hour in data["hourly"])
    assert data["yearly"]["total"]["trades"] == 0
    assert data["yearly"]["total"]["win_rate"] is None
    assert data["insights"]["best_strategy"] is None
    assert data["rule_discipline"]["by_strategy"]["__all__"]["discipline_rate"] is None
    assert data["duration_pnl"] == []


def test_weekly_hourly_and_yearly_use_real_results():
    trades = [
        _trade(pnl=100),
        _trade(pnl=40, symbol="AAPL"),
        _trade(pnl=-25, symbol="AAPL", strategy_name="Reversal", side=SimpleNamespace(value="short")),
    ]
    data = build_performance(
        trades,
        "UTC",
        date_from=datetime(2026, 9, 1),
        date_to=datetime(2026, 10, 31),
    )
    DashboardPerformance.model_validate(data)
    friday = data["weekly_win_rate"][5]
    assert friday["day"] == "Fri"
    assert friday["trades"] == 3
    assert friday["wins"] == 2
    assert friday["losses"] == 1
    assert friday["win_rate"] == 66.7
    assert friday["pnl"] == 115.0
    assert data["weekly_win_rate"][0]["trades"] == 0

    hour = data["hourly"][15]
    assert hour["label"] == "15:00"
    assert hour["trades"] == 3
    assert hour["win_rate"] == 66.7
    assert data["hourly"][0]["win_rate"] is None

    october = data["yearly"]["months"][9]
    assert october["label"] == "Oct"
    assert october["pnl"] == 115.0
    assert october["win_rate"] == 66.7
    assert data["yearly"]["months"][0]["pnl"] is None
    assert data["yearly"]["total"]["trades"] == 3
    assert data["yearly"]["year"] == 2026

    profit = next(row for row in data["monthly_profit"] if row["month"] == 10)
    assert profit["pnl"] == 115.0
    september = next(row for row in data["monthly_profit"] if row["month"] == 9)
    assert september["trades"] == 0
    assert september["pnl"] is None


def test_duration_points_measure_hold_time():
    opened = datetime(2026, 10, 2, 15, 30, tzinfo=timezone.utc)
    data = build_performance(
        [
            _trade(opened_at=opened, closed_at=opened + timedelta(minutes=1, seconds=16), pnl=0),
            _trade(opened_at=opened, closed_at=opened + timedelta(hours=2, minutes=5), pnl=50),
            _trade(opened_at=opened, closed_at=None, pnl=10),
        ],
        "UTC",
    )
    DashboardPerformance.model_validate(data)
    assert data["duration_pnl"] == [
        {"seconds": 76, "pnl": 0.0},
        {"seconds": 7500, "pnl": 50.0},
    ]


def test_timezone_moves_entry_to_previous_local_day():
    # Monday 03:30 UTC is Sunday 20:30 in Los Angeles (PDT, UTC-7).
    opened = datetime(2026, 10, 5, 3, 30, tzinfo=timezone.utc)
    data = build_performance([_trade(opened_at=opened, closed_at=opened, pnl=-10)], "America/Los_Angeles")
    sunday = data["weekly_win_rate"][0]
    assert sunday["day"] == "Sun"
    assert sunday["trades"] == 1
    assert sunday["losses"] == 1
    assert data["hourly"][20]["trades"] == 1
    assert data["hourly"][3]["trades"] == 0


def test_negative_month_rules_symbols_and_insights():
    opened = datetime(2026, 9, 15, 18, 0, tzinfo=timezone.utc)
    trades = [
        _trade(pnl=200, opened_at=opened, closed_at=opened, symbol="XAUUSD", rules_broken=[]),
        _trade(
            pnl=-80,
            opened_at=opened,
            closed_at=opened,
            symbol="XAUUSD",
            strategy_name="Reversal",
            side=SimpleNamespace(value="short"),
            rules_broken=["Maximum Risk", "Late entry"],
            session="New York",
            entry_timeframe="1H",
            mood="FOMO",
            extra={"moods": ["FOMO"], "went_well": []},
        ),
        _trade(
            pnl=-40,
            opened_at=opened,
            closed_at=opened,
            symbol="EURUSD",
            strategy_name="Reversal",
            rules_broken=["Maximum Risk"],
            session="New York",
            extra={"went_well": ["Patient entry"]},
            mood="Calm",
        ),
    ]
    data = build_performance(trades, "UTC", date_to=datetime(2026, 10, 7))
    september = next(row for row in data["monthly_profit"] if row["label"] == "2026/09")
    assert september["pnl"] == 80.0
    assert september["wins"] == 1
    assert september["losses"] == 2

    symbols = {row["symbol"]: row for row in data["symbols"]}
    assert symbols["XAUUSD"]["pnl"] == 120.0
    assert symbols["XAUUSD"]["trades"] == 2
    assert symbols["EURUSD"]["win_rate"] == 0.0

    reversal = next(row for row in data["strategies"] if row["name"] == "Reversal")
    assert reversal["trades"] == 2
    assert reversal["profit_factor"] == 0.0 or reversal["pnl"] == -120.0
    assert reversal["win_rate"] == 0.0

    discipline = data["rule_discipline"]["by_strategy"]["__all__"]
    assert discipline["followed"] == 1
    assert discipline["violated"] == 2
    assert discipline["discipline_rate"] == 33.3
    assert discipline["most_violated_rule"] == "Maximum Risk"
    assert discipline["most_violated_count"] == 2
    reversal_rules = data["rule_discipline"]["by_strategy"]["Reversal"]
    assert reversal_rules["followed"] == 0
    assert reversal_rules["violated"] == 2

    insights = data["insights"]
    assert insights["best_strategy"]["name"] == "Breakout"
    assert insights["best_session"]["name"] == "London"
    assert insights["best_timeframe"]["name"] == "15m"
    assert insights["most_common_mistake"]["name"] == "Maximum Risk"
    assert insights["most_common_mistake"]["occurrences"] == 2
    assert insights["most_common_mistake"]["pnl"] == -120.0
    assert insights["best_entry"]["name"] == "Break of structure"
    moods = {row["name"]: row for row in insights["moods"]}
    assert moods["FOMO"]["trades"] == 1
    assert moods["FOMO"]["pnl"] == -80.0
    assert insights["went_well"][0]["name"] == "Patient entry"
    assert {row["name"] for row in insights["sides"]} == {"Long", "Short"}


def test_missing_metadata_is_grouped_not_invented():
    trade = _trade(
        strategy_name=None,
        session=None,
        entry_timeframe=None,
        analysis_timeframe=None,
        entry_condition=None,
        exit_condition=None,
        trade_type=None,
        mood=None,
        extra={},
        rules_broken=[],
    )
    data = build_performance([trade], "UTC")
    assert data["strategies"][0]["id"] == "__none__"
    assert data["strategies"][0]["name"] == "No strategy"
    assert data["insights"]["best_session"] is None
    assert data["insights"]["best_timeframe"] is None
    assert data["insights"]["best_entry"] is None
    assert data["insights"]["most_common_mistake"] is None
    assert data["rule_discipline"]["by_strategy"]["__all__"]["followed"] == 1
    assert data["rule_discipline"]["by_strategy"]["__all__"]["most_violated_rule"] is None
