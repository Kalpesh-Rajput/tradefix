from datetime import datetime, timezone

from app.services.ai.heuristic import (
    classify_question,
    looks_like_data_question,
    looks_like_news_question,
    news_query,
    quick_reply,
)


def test_greeting_is_direct():
    plan = classify_question("Hello")
    assert plan.intent == "direct"
    assert plan.tools == []
    assert looks_like_data_question("Hello") is False
    reply = quick_reply("Hello")
    assert reply is not None and "help" in reply.lower()
    assert quick_reply("What is my win rate?") is None
    assert quick_reply("hello, what is my win rate?") is None


def test_news_question_uses_web_search():
    assert looks_like_news_question("What is the latest news on Fed rates?")
    assert news_query("What is the latest news on Fed rates?") == "Fed rates"
    plan = classify_question("What is the latest news on Fed rates?")
    assert plan.intent == "web_search"
    assert ("search_web", {"query": "Fed rates"}) in [(name, args) for name, args in plan.tools]
    assert looks_like_news_question("Hello") is False


def test_best_time_of_day_uses_session_stats():
    plan = classify_question("What is my best time of day?")
    names = [name for name, _ in plan.tools]
    assert "get_session_statistics" in names


def test_win_rate_uses_stats_tool():
    plan = classify_question("What is my win rate?")
    names = [name for name, _ in plan.tools]
    assert "get_trade_statistics" in names


def test_breakout_hybrid_includes_journal_and_setup():
    plan = classify_question("Why am I losing on breakout trades?")
    names = {name for name, _ in plan.tools}
    assert "get_setup_statistics" in names
    assert "search_user_journal" in names
    assert plan.intent == "hybrid"


def test_this_month_filter():
    now = datetime(2026, 9, 19, tzinfo=timezone.utc)
    plan = classify_question("What is my total P&L this month?", now=now)
    args = dict(plan.tools[0][1])
    assert args["date_from"] == "2026-09-01"
    assert args["date_to"] == "2026-09-30"
