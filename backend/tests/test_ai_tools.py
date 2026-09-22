from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from app.services import stats_service
from app.services.ai.tools.analytics import get_setup_statistics, get_trade_statistics
from app.services.ai.tools.context import ToolContext
from app.services.ai.tools.filters import compact_overview, sanitize_tool_args
from app.services.ai.tools.registry import execute_tool, resolve_tool_call

OPENED = datetime(2026, 9, 10, 16, 30, tzinfo=timezone.utc)


def _trade(pnl: float, setup: str = "Breakout", symbol: str = "NQ") -> SimpleNamespace:
    return SimpleNamespace(
        pnl=pnl,
        fees=0.0,
        symbol=symbol,
        opened_at=OPENED,
        closed_at=OPENED,
        setup_tag=setup,
        setup_tags=[setup],
        emotion_tags=["FOMO"] if pnl < 0 else [],
        rules_broken=["early entry"] if pnl < 0 else [],
        session="NY",
        side="long",
        mood="3",
        notes="Entered before confirmation" if pnl < 0 else "Plan followed",
        plan_compliance=None,
        screenshot_urls=[],
        risk_amount=None,
        score_preparation=None,
        score_risk=None,
        score_entry=None,
        score_exit=None,
        score_discipline=None,
        score_psychology=None,
    )


def test_sanitize_tool_args_drops_user_id():
    cleaned = sanitize_tool_args({"user_id": str(uuid4()), "symbol": "NQ", "userId": "nope"})
    assert "user_id" not in cleaned
    assert "userId" not in cleaned
    assert cleaned["symbol"] == "NQ"


def test_execute_tool_ignores_model_user_id(monkeypatch):
    user_a = uuid4()
    seen = {}

    def fake_stats(ctx, args):
        seen["user_id"] = ctx.user_id
        seen["args"] = args
        return {"ok": True}

    monkeypatch.setattr("app.services.ai.tools.registry.HANDLERS", {"get_trade_statistics": fake_stats})
    ctx = ToolContext(db=MagicMock(), user_id=user_a)
    execute_tool("get_trade_statistics", {"user_id": str(uuid4()), "symbol": "ES"}, ctx)
    assert seen["user_id"] == user_a
    assert "user_id" not in seen["args"]


def test_trade_statistics_match_stats_service(monkeypatch):
    trades = [_trade(100), _trade(-40), _trade(20)]
    monkeypatch.setattr(stats_service, "_closed_trades", lambda *args, **kwargs: trades)
    ctx = ToolContext(db=MagicMock(), user_id=uuid4())
    result = get_trade_statistics(ctx, {})
    expected = compact_overview(stats_service.overview_from_trades(trades))
    assert result["win_rate"] == expected["win_rate"]
    assert result["total_pnl"] == expected["total_pnl"]
    assert result["expectancy"] == expected["expectancy"]
    assert result["profit_factor"] == expected["profit_factor"]
    assert result["total_trades"] == 3


def test_setup_statistics_use_overview(monkeypatch):
    trades = [_trade(100, "Breakout"), _trade(-50, "Breakout"), _trade(80, "OR")]
    monkeypatch.setattr(stats_service, "_closed_trades", lambda *args, **kwargs: trades)
    ctx = ToolContext(db=MagicMock(), user_id=uuid4())
    result = get_setup_statistics(ctx, {"setup": "Breakout"})
    assert result["setups"]
    row = result["setups"][0]
    expected = compact_overview(stats_service.overview_from_trades(trades[:2]))
    assert row["win_rate"] == expected["win_rate"]
    assert row["total_pnl"] == expected["total_pnl"]


def test_search_web_parses_articles_and_records_sources(monkeypatch):
    from app.services.ai.tools import web

    xml = """<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>Fed holds rates - Reuters</title>
        <link>https://news.google.com/rss/articles/abc</link>
        <pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate>
        <description>The Federal Reserve left rates unchanged.</description>
        <source url="https://www.reuters.com">Reuters</source>
      </item>
      <item>
        <title>Skip insecure</title>
        <link>http://example.com/a</link>
      </item>
    </channel></rss>"""
    monkeypatch.setattr(web, "_fetch_rss", lambda query: xml)
    ctx = ToolContext(db=MagicMock(), user_id=uuid4())
    result = web.search_web(ctx, {"query": "Fed rates"})
    assert result["query"] == "Fed rates"
    assert len(result["results"]) == 1
    assert result["results"][0]["title"] == "Fed holds rates"
    assert result["results"][0]["publisher"] == "Reuters"
    assert ctx.sources[0].type == "web"
    assert ctx.sources[0].url.startswith("https://")
    assert ctx.sources[0].as_dict()["snippet"]


def test_invented_time_tool_maps_to_session_stats():
    name, args = resolve_tool_call("best_time_of_day", {"metric": "best_time_of_day"})
    assert name == "get_session_statistics"
    assert "metric" not in args
    name, _args = resolve_tool_call(
        "fetch_deterministic_statistics",
        {"metric": "best_time_of_day"},
    )
    assert name == "get_session_statistics"


def test_empty_statistics(monkeypatch):
    monkeypatch.setattr(stats_service, "_closed_trades", lambda *args, **kwargs: [])
    ctx = ToolContext(db=MagicMock(), user_id=uuid4())
    result = get_trade_statistics(ctx, {})
    assert result["insufficient_data"] is True
    assert result["total_trades"] == 0
    assert result["total_pnl"] == 0.0
