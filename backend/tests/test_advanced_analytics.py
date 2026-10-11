from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.advanced_analytics import montecarlo, performance, psychology, risk, strategy, timing
from app.services.advanced_analytics import discipline, insights
from app.services.advanced_analytics.core import (
    DIMENSIONS,
    Filters,
    build_context,
    build_view,
    group_by,
    keys_for,
    matches,
    previous_range,
    stats,
    zone,
)
from app.services.stats_service import (
    expectancy,
    max_drawdown_from_trades,
    overview_from_trades,
    profit_factor,
    r_distribution,
    win_rate,
)
from app.services.trade_scores import r_multiple

UTC = zone("UTC")
BASE = datetime(2026, 3, 2, 14, 30, tzinfo=timezone.utc)  # Monday


def trade(pnl, *, fees=0.0, minutes=0, hold=30, **kw):
    opened = kw.pop("opened_at", BASE + timedelta(minutes=minutes))
    closed = kw.pop("closed_at", opened + timedelta(minutes=hold))
    data = dict(
        id=kw.pop("id", uuid4()),
        symbol="ES",
        side="long",
        asset_type="future",
        pnl=pnl,
        fees=fees,
        opened_at=opened,
        closed_at=closed,
        quantity=1,
        entry_price=100.0,
        exit_price=101.0,
        stop_loss=None,
        profit_target=None,
        risk_amount=None,
        session=None,
        strategy_name=None,
        setup_tag=None,
        setup_tags=[],
        emotion_tags=[],
        rules_broken=[],
        mood=None,
        extra={},
        plan_compliance=None,
        screenshot_urls=[],
        score_preparation=None,
        score_risk=None,
        score_entry=None,
        score_exit=None,
        score_discipline=None,
        score_psychology=None,
    )
    data.update(kw)
    return SimpleNamespace(**data)


def views_of(trades, mode="net", tz=UTC):
    return [v for v in (build_view(t, tz, mode) for t in trades) if v is not None]


def series(pnls, step_minutes=60, **kw):
    return [trade(p, minutes=i * step_minutes, **kw) for i, p in enumerate(pnls)]


# ---------- parity with stats_service ----------


def test_core_stats_match_stats_service():
    trades = series([120, -40, 0, 75.5, -60, 10])
    s = stats(views_of(trades))
    assert s["win_rate"] == win_rate(trades)
    assert s["profit_factor"] == profit_factor(trades)
    assert s["avg_pnl"] == expectancy(trades)
    ov = overview_from_trades(trades, starting_equity=1000)
    assert s["wins"] == ov["win_count"] and s["losses"] == ov["loss_count"] and s["breakeven"] == ov["breakeven_count"]
    assert s["avg_win"] == ov["avg_win"] and s["avg_loss"] == ov["avg_loss"]


def test_drawdown_matches_stats_service():
    trades = series([100, -50, -80, 40, 200, -30])
    k = performance.kpis(views_of(trades), 1000.0)
    amount, pct = max_drawdown_from_trades(trades, starting_equity=1000.0)
    assert k["max_drawdown"] == amount == 130.0
    assert k["max_drawdown_pct"] == pct
    episodes = performance.equity(views_of(trades), 1000.0)["episodes"]
    assert episodes[0]["depth"] == 130.0
    assert episodes[0]["recovered"] is True


def test_r_matches_trade_scores_and_distribution():
    trades = series([200, -100, 50, -100, 300], risk_amount=100)
    views = views_of(trades)
    assert [v.r for v in views] == [r_multiple(t) for t in trades]
    dist = {row["bucket"]: row["count"] for row in risk.r_stats(views)["distribution"]}
    assert dist == {row["bucket"]: row["count"] for row in r_distribution(trades)}


def test_profit_factor_undefined_without_losses():
    s = stats(views_of(series([10, 20, 30])))
    assert s["profit_factor"] is None and s["payoff"] is None
    assert profit_factor(series([10, 20, 30])) == 0.0  # legacy shape stays untouched


# ---------- P&L basis ----------


def test_gross_adds_fees_once_and_ignores_component_fields():
    t = trade(95.0, fees=5.0, commission=3.0, swap=2.0)
    net = build_view(t, UTC, "net")
    gross = build_view(t, UTC, "gross")
    assert net.pnl == 95.0 and gross.pnl == 100.0
    assert gross.net_pnl == 95.0
    assert gross.r is None


def test_gross_can_flip_outcome_and_r_stays_net():
    t = trade(-2.0, fees=5.0, risk_amount=50)
    assert build_view(t, UTC, "net").outcome == "loss"
    g = build_view(t, UTC, "gross")
    assert g.outcome == "win" and g.r == -0.04


def test_invalid_pnl_is_skipped():
    assert build_view(trade(None), UTC, "net") is None
    assert build_view(trade(float("nan")), UTC, "net") is None


# ---------- small samples ----------


def test_empty_history_every_module():
    views = []
    ctx = build_context(views)
    assert performance.kpis(views, 0)["trades"] == 0
    assert performance.daily_distribution(views)["status"] == "insufficient"
    assert risk.r_stats(views)["status"] == "insufficient"
    assert risk.sqn(views)["status"] == "insufficient"
    assert risk.kelly(views)["status"] == "insufficient"
    assert risk.streaks(views)["max_win_streak"] == 0
    assert montecarlo.simulate([], starting_balance=1000)["status"] == "insufficient"
    assert timing.build(views, ctx)["weekday_hour"] == []
    assert strategy.build(views, ctx)["strategies"] == []
    assert psychology.build(views, ctx)["emotions"]["rows"] == []
    assert discipline.build(views, ctx, None)["clean_vs_broken"]["clean_rate"] is None
    assert insights.build(views, ctx, "all time")["status"] == "insufficient"


def test_single_trade():
    views = views_of([trade(50)])
    k = performance.kpis(views, 1000)
    assert k["trades"] == 1 and k["win_rate"] == 100.0 and k["max_drawdown"] == 0
    assert performance.equity(views, 1000)["episodes"] == []


def test_breakeven_counts_in_denominator_and_breaks_streaks():
    views = views_of(series([10, 20, 0, 30]))
    assert stats(views)["win_rate"] == 75.0
    s = risk.streaks(views)
    assert s["max_win_streak"] == 2 and s["current_type"] == "win" and s["current_length"] == 1
    assert risk.streaks(views_of(series([10, 0])))["current_type"] == "none"


def test_period_comparison_requires_five_each():
    big = performance.kpis(views_of(series([10] * 6)), 0)
    small = performance.kpis(views_of(series([10] * 3)), 0)
    assert performance.comparison(big, small) is None
    cmp = performance.comparison(big, performance.kpis(views_of(series([5] * 5)), 0))
    assert cmp["net_pnl"]["delta"] == 35.0


def test_previous_range_equal_length():
    assert previous_range(Filters(date(2026, 3, 1), date(2026, 3, 31))) == (date(2026, 1, 29), date(2026, 2, 28))
    assert previous_range(Filters(date(2026, 3, 1), None)) is None


# ---------- risk ----------


def test_sqn_and_kelly_thresholds():
    small = views_of(series([100, -50] * 10, risk_amount=50))
    assert risk.sqn(small)["status"] == "insufficient"
    pnls = [150, -50, 100, -50, 200, -50] * 6
    big = views_of(series(pnls, risk_amount=50))
    out = risk.sqn(big)
    assert out["status"] == "ok" and out["value"] > 0
    k = risk.kelly(big)
    assert k["status"] == "ok" and k["range_low_pct"] <= k["value_pct"] <= k["range_high_pct"]
    assert k["stability"] == "unstable"  # < 100 decisive trades
    assert "not a position-size recommendation" in k["note"]


def test_kelly_wide_range_is_unstable_even_with_large_sample():
    views = views_of(series([127, -100] * 60))
    k = risk.kelly(views)
    assert k["sample_size"] == 120 and k["range_high_pct"] - k["range_low_pct"] > 15
    assert k["stability"] == "unstable"


def test_missing_risk_reports_coverage():
    views = views_of(series([10, -5] * 10))
    out = risk.r_stats(views)
    assert out["status"] == "insufficient" and out["coverage_pct"] == 0.0


def test_plan_vs_outcome_rejects_invalid_or_moved_stops():
    good = [trade(200, risk_amount=100, entry_price=100, stop_loss=99, profit_target=102) for _ in range(10)]
    moved = [trade(50, risk_amount=100, entry_price=100, stop_loss=100.5, profit_target=102) for _ in range(5)]
    short_bad = [trade(50, side="short", risk_amount=100, entry_price=100, stop_loss=99, profit_target=98)]
    out = risk.plan_vs_outcome(views_of(good + moved + short_bad))
    assert out["status"] == "ok" and out["sample_size"] == 10
    assert out["avg_planned_r"] == 2.0 and out["target_reached_pct"] == 100.0
    assert "last recorded stop" in out["note"]


# ---------- Monte Carlo ----------


def test_monte_carlo_deterministic_and_cached():
    montecarlo.cache_clear()
    pnls = [120, -80, 60, -40, 200, -100, 30, -20] * 5
    a = montecarlo.simulate(pnls, starting_balance=10000, seed=7)
    b = montecarlo.simulate(pnls, starting_balance=10000, seed=7)
    assert a["status"] == "ok" and a["cached"] is False and b["cached"] is True
    assert {k: v for k, v in a.items() if k != "cached"} == {k: v for k, v in b.items() if k != "cached"}
    c = montecarlo.simulate(pnls, starting_balance=10000, seed=8)
    assert c["bands"] != a["bands"]


def test_monte_carlo_path_definitions():
    pnls = [100.0] * 15 + [-50.0] * 15
    out = montecarlo.simulate(pnls, starting_balance=1000, seed=1, paths=500)
    assert out["bands"][0] == {"step": 0, "p5": 0.0, "p25": 0.0, "p50": 0.0, "p75": 0.0, "p95": 0.0, "historical": 0.0}
    assert out["bands"][-1]["historical"] == sum(pnls) == out["historical_final_pnl"]
    assert out["historical_max_drawdown"] == 750.0
    for band in out["bands"]:
        assert band["p5"] <= band["p25"] <= band["p50"] <= band["p75"] <= band["p95"]
    assert all(0 <= t["probability"] <= 100 for t in out["drawdown_thresholds"])
    assert [t["threshold_amount"] for t in out["drawdown_thresholds"]] == [100.0, 200.0, 300.0]
    assert out["max_drawdown"]["p5"] >= 0


def test_monte_carlo_all_losses_has_drawdown_from_start():
    out = montecarlo.simulate([-10.0] * 30, starting_balance=1000, seed=1, paths=200)
    assert out["max_drawdown"]["p50"] == 300.0 and out["prob_loss"] == 100.0


def test_monte_carlo_invalid_inputs():
    assert montecarlo.simulate([1.0] * 29, starting_balance=1)["status"] == "insufficient"
    assert montecarlo.simulate([0.0] * 40, starting_balance=1)["status"] == "insufficient"
    assert montecarlo.simulate([1.0, float("inf")] * 20, starting_balance=1)["status"] == "insufficient"
    no_balance = montecarlo.simulate([5.0, -3.0] * 20, starting_balance=0, paths=200)
    assert no_balance["status"] == "ok" and no_balance["drawdown_thresholds"] == [] and no_balance["starting_balance"] is None


# ---------- timezone ----------


def test_local_buckets_and_date_filter_respect_timezone():
    tz = zone("America/New_York")
    late = trade(10, opened_at=datetime(2026, 3, 3, 2, 30, tzinfo=timezone.utc))  # Mar 2 21:30 local
    v = views_of([late], tz=tz)[0]
    assert v.open_date == date(2026, 3, 2) and v.local_open.hour == 21
    assert keys_for("weekday", v, build_context([v])) == ["0"]
    assert matches(v, Filters(date(2026, 3, 2), date(2026, 3, 2)))
    assert not matches(v, Filters(date(2026, 3, 3), date(2026, 3, 3)))


def test_dst_transition_hour_bucket():
    tz = zone("America/New_York")
    before = views_of([trade(1, opened_at=datetime(2026, 3, 6, 14, 30, tzinfo=timezone.utc))], tz=tz)[0]
    after = views_of([trade(1, opened_at=datetime(2026, 3, 9, 13, 30, tzinfo=timezone.utc))], tz=tz)[0]
    assert before.local_open.hour == 9 and after.local_open.hour == 9


# ---------- filters ----------


def test_filters_and_multi_select():
    trades = [
        trade(10, symbol="ES", session="London", setup_tags=["ORB"], emotion_tags=["FOMO"]),
        trade(20, symbol="NQ", session="NY", setup_tags=["VWAP"]),
        trade(30, symbol="CL", rules_broken=["Oversized"]),
    ]
    views = views_of(trades)
    pick = lambda f: [v.symbol for v in views if matches(v, f.normalized())]
    assert pick(Filters(symbols=["es", "nq"])) == ["ES", "NQ"]
    assert pick(Filters(symbols=["ES", "NQ"], sessions=["NY"])) == ["NQ"]
    assert pick(Filters(setups=["ORB", "VWAP"])) == ["ES", "NQ"]
    assert pick(Filters(emotions=["Oversized"])) == ["CL"]
    assert pick(Filters(emotions=["FOMO"])) == ["ES"]


def test_session_falls_back_to_utc_hour():
    v = views_of([trade(1, opened_at=datetime(2026, 3, 2, 8, 0, tzinfo=timezone.utc))])[0]
    assert v.session == "London"


# ---------- behaviour ----------


def test_after_outcome_uses_known_results_only():
    t1 = trade(-50, opened_at=BASE, closed_at=BASE + timedelta(minutes=10))
    t2 = trade(30, opened_at=BASE + timedelta(minutes=5), closed_at=BASE + timedelta(minutes=40))  # overlaps t1
    t3 = trade(20, opened_at=BASE + timedelta(minutes=20), closed_at=BASE + timedelta(minutes=50))
    views = views_of([t1, t2, t3])
    ctx = build_context(views)
    by = {v.net_pnl: v for v in views}
    assert ctx.after[by[-50].id] == "first"
    assert ctx.after[by[30].id] == "first"  # t1 not closed yet when t2 opened
    assert ctx.after[by[20].id] == "after_loss"
    assert by[20].id in ctx.quick_reentry
    assert ctx.trade_number[by[20].id] == "3"


def test_label_comparison_overlap_and_evidence():
    fomo = [trade(-50 - i, minutes=i, emotion_tags=["FOMO", "Greed"]) for i in range(6)]
    calm = [trade(40 + i, minutes=100 + i, emotion_tags=["Calm"]) for i in range(6)]
    views = views_of(fomo + calm)
    comp = psychology.label_comparisons("emotion", views, build_context(views))
    row = next(r for r in comp["rows"] if r["key"] == "FOMO")
    assert row["n_with"] == 6 and row["n_without"] == 6 and row["evidence"] == "strong" and row["diff"] < 0
    assert comp["multi_label_trades"] == 6 and comp["overlap_pct"] == 50.0
    assert "not proof" in comp["note"]


def test_insights_require_evidence_and_have_drill_keys():
    views = views_of(series([10, -10, 12, -9]))
    assert insights.build(views, build_context(views), "all time")["items"] == []
    fomo = [trade(-50 - i, minutes=i, emotion_tags=["FOMO"]) for i in range(8)]
    rest = [trade(40 + i, minutes=200 + i) for i in range(8)]
    views = views_of(fomo + rest)
    ctx = build_context(views)
    out = insights.build(views, ctx, "all time")
    item = next(i for i in out["items"] if i["dimension"] == "emotion")
    assert item["tone"] == "negative" and item["sample_size"] == 8 and item["comparison_size"] == 8
    drilled = [v for v in views if item["drill"]["key"] in keys_for(item["drill"]["dimension"], v, ctx)]
    assert len(drilled) == item["sample_size"]
    assert "not proof of cause" in item["explanation"]


def test_duplicates_flagged_not_removed():
    a = trade(10, id="a")
    b = trade(10, id="b")
    c = trade(11, id="c")
    views = views_of([a, b, c])
    ctx = build_context(views)
    assert ctx.duplicates == {"a", "b"}
    assert stats(views)["trades"] == 3


# ---------- drill-down consistency ----------


@pytest.mark.parametrize("dimension", sorted(DIMENSIONS))
def test_every_dimension_groups_match_key_lookup(dimension):
    trades = [
        trade(
            p,
            minutes=i * 97,
            hold=(i % 5) * 400 + 10,
            symbol=["ES", "NQ", "CL"][i % 3],
            side=["long", "short"][i % 2],
            setup_tags=[["ORB"], ["VWAP", "ORB"], []][i % 3],
            emotion_tags=[["FOMO"], [], ["Calm", "FOMO"]][i % 3],
            rules_broken=[[], ["Oversized"]][i % 2],
            plan_compliance=i % 11,
            risk_amount=50 if i % 2 else None,
            strategy_name=["Breakout", None][i % 2],
        )
        for i, p in enumerate([50, -20, 0, 75, -60, 10, 30, -5, 90, -45, 15, 0])
    ]
    views = views_of(trades)
    ctx = build_context(views, checkins={views[0].realized_date: "yes"}, mood_scores={views[0].open_date: 4})
    for key, group in group_by(dimension, views, ctx).items():
        drilled = [v for v in views if key in keys_for(dimension, v, ctx)]
        assert {v.id for v in drilled} == {v.id for v in group}


def test_timing_counts_sum_to_total():
    views = views_of(series([10, -5, 20, -8, 3, 7], step_minutes=300))
    t = timing.build(views, build_context(views))
    assert sum(c["trades"] for c in t["weekday_hour"]) == len(views)
    assert sum(c["trades"] for c in t["weekdays"]) == len(views)
    assert sum(c["trades"] for c in t["hold_buckets"]) == len(views)


def test_monthly_return_uses_equity_at_month_start():
    t1 = trade(100, opened_at=datetime(2026, 1, 10, tzinfo=timezone.utc))
    t2 = trade(110, opened_at=datetime(2026, 2, 10, tzinfo=timezone.utc))
    rows = performance.monthly(views_of([t1, t2]), 1000)
    assert rows[0]["return_pct"] == 10.0 and rows[1]["equity_start"] == 1100.0 and rows[1]["return_pct"] == 10.0
    assert performance.monthly(views_of([t1]), 0)[0]["return_pct"] is None


def test_symbol_top_list_keeps_biggest_losers():
    trades = [trade(10 + i, symbol=f"W{i:02d}", minutes=i) for i in range(20)]
    trades.append(trade(-500, symbol="LOSER", minutes=30))
    views = views_of(trades)
    out = strategy.build(views, build_context(views))
    keys = [r["key"] for r in out["symbols"]]
    assert "LOSER" in keys and keys[-1] == "LOSER"
    assert len(keys) == strategy.TOP_SYMBOLS
    assert out["symbols_other"]["symbols"] == 21 - strategy.TOP_SYMBOLS
    assert sum(r["trades"] for r in out["symbols"]) + out["symbols_other"]["trades"] == 21
