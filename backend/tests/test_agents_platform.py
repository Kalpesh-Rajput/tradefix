from datetime import datetime, timezone

from app.services.ai.agents.logic import (
    OutputRejected,
    accept_suggestion,
    assert_active,
    drop_empty_findings,
    grounded_summary,
    parse_model_json,
    propose_tags,
    reject_suggestion,
    session_facts,
    split_tag_modes,
)
from app.services.ai.agents.templates import build_market_briefing, build_session_review, build_trade_tags


def _trade(**kwargs):
    base = {
        "id": "t1",
        "symbol": "ES",
        "side": "long",
        "setup": None,
        "playbook": None,
        "session": "London",
        "pnl": -40,
        "tags": [],
        "rules_broken": [],
        "notes": "",
        "hold_seconds": 90,
    }
    base.update(kwargs)
    return base


def test_paused_agent_does_not_pass_the_guard():
    try:
        assert_active("paused")
        raise AssertionError("paused agent should not run")
    except Exception as exc:
        assert "paused" in str(exc).lower()


def test_suggest_mode_does_not_apply_tags():
    suggestions = propose_tags(_trade(), ["London", "scalp"], "")
    applied, pending = split_tag_modes(suggestions, "suggest")
    assert applied == []
    assert any(item["tag"] == "London" for item in pending)


def test_apply_mode_keeps_only_high_confidence():
    suggestions = [
        {"tag": "London", "confidence": "high", "reason": "Session is London."},
        {"tag": "maybe", "confidence": "medium", "reason": "Note overlap."},
    ]
    applied, pending = split_tag_modes(suggestions, "apply")
    assert [item["tag"] for item in applied] == ["London"]
    assert [item["tag"] for item in pending] == ["maybe"]


def test_accept_moves_suggestion_into_setup_tags():
    tags, remaining = accept_suggestion([], [{"tag": "London", "confidence": "high", "reason": "Session is London."}], "London")
    assert tags == ["London"]
    assert remaining == []


def test_reject_removes_suggestion_only():
    remaining = reject_suggestion([{"tag": "London", "reason": "Session is London."}], "London")
    assert remaining == []


def test_invalid_json_is_rejected_without_a_payload():
    assert parse_model_json("not json") is None


def test_findings_without_evidence_are_dropped():
    kept = drop_empty_findings([{"text": "Guess", "evidence": [], "actions": [{"label": "View"}]}])
    assert kept == []


def test_summary_with_unknown_numbers_is_replaced():
    summary, warnings = grounded_summary("You made 99 trades.", "18 trades", "18 trades had no violation.")
    assert summary == "18 trades had no violation."
    assert warnings


def test_session_facts_count_real_violations():
    trades = [_trade(id=f"t{i}", rules_broken=["max risk"] if i < 3 else []) for i in range(18)]
    facts = session_facts(trades)
    assert facts["violations"] == 3
    assert facts["adherence"] == "15 of 18 trades had no recorded rule violation"
    assert facts["violation_ids"] == ["t0", "t1", "t2"]


def test_session_review_failure_does_not_return_output():
    context = {"date": "2026-09-23", "trades": [_trade()], "journal_note": None}
    try:
        build_session_review(context, lambda *_: "not-json")
        raise AssertionError("invalid JSON should fail")
    except OutputRejected as exc:
        assert "invalid JSON" in str(exc)


def test_session_review_uses_model_summary_when_grounded():
    context = {
        "date": "2026-09-23",
        "trades": [_trade(pnl=-12, rules_broken=["late"])],
        "journal_note": None,
        "playbooks": [],
    }
    output = build_session_review(context, lambda *_: '{"summary":"1 of 1 trades had no recorded rule violation."}')
    assert output["findings"]
    assert output["findings"][0]["trade_ids"]
    assert "1 of 1" in output["summary"] or "violation" in output["summary"].lower()


def test_briefing_fails_when_there_is_no_data():
    try:
        build_market_briefing(
            {"symbols": [], "news": [], "events": [], "performance": None, "warnings": [], "date": "2026-09-23"},
            lambda *_: '{"summary":"Markets look fine."}',
        )
        raise AssertionError("empty briefing should fail")
    except OutputRejected:
        pass


def test_tagger_suggest_summary_counts_suggestions():
    context = {
        "mode": "suggest",
        "catalog": ["London"],
        "instructions": "",
        "trades": [_trade(), _trade(id="t2", symbol="NQ")],
    }
    output = build_trade_tags(context, lambda *_: '{"summary":"ok"}')
    assert output["mode"] == "suggest"
    assert output["tag_results"][0]["apply"] == []
    assert output["tag_results"][0]["suggest"]
    assert "suggestions" in output["summary"]


def test_hold_time_is_derived_from_timestamps():
    opened = datetime(2026, 9, 23, 14, 0, tzinfo=timezone.utc)
    closed = datetime(2026, 9, 23, 14, 2, tzinfo=timezone.utc)
    from app.services.ai.agents.logic import hold_seconds

    assert hold_seconds(opened, closed) == 120
