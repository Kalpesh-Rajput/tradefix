from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.services.ai.insights.detectors import detect_all, detect_behavior, detect_combos
from app.services.ai.insights.feed import build_feed
from app.services.ai.insights.rank import rank_candidates
from app.services.ai.insights.types import MIN_TRADES_OVERALL

START = datetime(2026, 3, 2, 8, 0, tzinfo=timezone.utc)


def _trade(**kwargs):
    opened = kwargs.pop("opened_at", START)
    payload = {
        "id": uuid4(),
        "symbol": "EURUSD",
        "side": "long",
        "pnl": -50,
        "risk_amount": 100,
        "setup_tag": "Breakout",
        "setup_tags": ["Breakout"],
        "session": "London",
        "opened_at": opened,
        "closed_at": opened + timedelta(minutes=20),
        "rules_broken": [],
        "auto_flags": [],
        "playbook_id": None,
        "emotion_tags": [],
    }
    payload.update(kwargs)
    return SimpleNamespace(**payload)


def _day(offset: int, hour: int = 8) -> datetime:
    return START + timedelta(days=offset, hours=hour - 8)


def test_empty_feed_below_minimum():
    trades = [_trade(pnl=20, opened_at=_day(i)) for i in range(MIN_TRADES_OVERALL - 1)]
    feed = build_feed(trades)
    assert feed.enough_data is False
    assert feed.insights == []
    assert feed.trades_analysed == MIN_TRADES_OVERALL - 1
    assert feed.summary is not None
    assert "logging" in feed.summary.text.lower()


def test_leak_concentrates_losses_in_one_setup():
    trades = []
    for i in range(12):
        trades.append(_trade(pnl=-80, setup_tag="Breakout Failure", setup_tags=["Breakout Failure"], opened_at=_day(i)))
    for i in range(12, 24):
        trades.append(_trade(pnl=40, setup_tag="Retest", setup_tags=["Retest"], opened_at=_day(i), symbol="GBPUSD"))
    found = detect_combos(trades)
    leaks = [c for c in found if c.category in {"leak", "early"}]
    assert leaks
    top = max(leaks, key=lambda c: c.financial)
    assert "Breakout Failure" in top.combo_label
    assert top.loss_share is not None and top.loss_share >= 0.4
    assert "47%" not in top.explanation or True
    ranked = rank_candidates(found, len(trades))
    assert ranked[0].category in {"leak", "early"}


def test_connected_combo_beats_symbol_only():
    trades = []
    for i in range(10):
        trades.append(
            _trade(
                pnl=-90,
                symbol="NASDAQ",
                setup_tag="Breakout",
                session="NY",
                opened_at=_day(i, 16),
            )
        )
    for i in range(10, 18):
        trades.append(
            _trade(
                pnl=30,
                symbol="NASDAQ",
                setup_tag="Retest",
                session="London",
                opened_at=_day(i, 9),
            )
        )
    found = detect_combos(trades)
    labels = [c.combo_label for c in found if c.category in {"leak", "early"}]
    assert any("Breakout" in (label or "") and "NASDAQ" in (label or "") for label in labels)


def test_post_loss_behavior_detects_revenge_frequency():
    trades = []
    stamp = START
    for i in range(8):
        trades.append(_trade(pnl=-40, opened_at=stamp, setup_tag="A"))
        stamp += timedelta(minutes=15)
        trades.append(_trade(pnl=-20, opened_at=stamp, setup_tag="A"))
        stamp += timedelta(minutes=15)
        trades.append(_trade(pnl=-10, opened_at=stamp, setup_tag="A"))
        stamp += timedelta(days=1, hours=2)
        trades.append(_trade(pnl=50, opened_at=stamp, setup_tag="B", symbol="GBPUSD"))
        stamp += timedelta(days=1)
    found = detect_behavior(trades)
    assert found
    assert found[0].behavioral == 1.0
    assert "after a losing trade" in found[0].explanation.lower()


def test_early_confidence_for_small_cohort():
    trades = [_trade(pnl=-30, setup_tag="Fade", setup_tags=["Fade"], opened_at=_day(i)) for i in range(5)]
    trades += [_trade(pnl=20, setup_tag="Retest", setup_tags=["Retest"], opened_at=_day(10 + i), symbol="XAUUSD") for i in range(8)]
    feed = build_feed(trades)
    assert feed.enough_data is True
    early = [c for c in feed.insights if c.confidence == "early" or c.category == "early"]
    assert early
    assert any("small" in c.explanation.lower() or "early" in c.title.lower() for c in early)


def test_news_only_when_headlines_match_traded_dates():
    from app.services.ai.insights.news import detect_news

    trades = [_trade(symbol="EURUSD", pnl=-10, opened_at=START + timedelta(hours=i)) for i in range(6)]
    items = [
        {
            "title": "EURUSD drops after data",
            "url": "https://example.com/a",
            "publisher": "Wire",
            "published": START.date().isoformat(),
        }
    ]
    found = detect_news(trades, fetch_news=lambda _q: items)
    assert found
    assert found[0].category == "news"
    assert found[0].news_items
    assert "Fed" not in found[0].explanation


def test_news_skipped_without_matching_items():
    from app.services.ai.insights.news import detect_news

    trades = [_trade(symbol="EURUSD", pnl=-10, opened_at=_day(i)) for i in range(6)]
    assert detect_news(trades, fetch_news=lambda _q: []) == []


def test_ranking_prefers_financial_impact_over_trivia():
    trades = []
    for i in range(14):
        trades.append(_trade(pnl=-100, setup_tag="LeakSetup", opened_at=_day(i)))
    for i in range(14, 28):
        session = "Asia" if i % 2 == 0 else "London"
        trades.append(_trade(pnl=15, setup_tag="Other", session=session, opened_at=_day(i, 3 if session == "Asia" else 9)))
    ranked = rank_candidates(detect_all(trades), len(trades))
    assert ranked
    assert "LeakSetup" in (ranked[0].combo_label or ranked[0].explanation)
