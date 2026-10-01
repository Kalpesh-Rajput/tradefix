from __future__ import annotations

import json

from app.services.ai.agents.logic import OutputRejected, drop_empty_findings, grounded_summary, money, parse_model_json

SYSTEM = (
    "You write TradeFix agent output as JSON only. "
    "Use only facts present in the user payload. Do not invent prices, headlines, or trade counts. "
    'Return {"summary": "..."} and nothing else.'
)


def _require_json(raw: str | None) -> dict:
    parsed = parse_model_json(raw)
    if parsed is None:
        raise OutputRejected("The model returned invalid JSON.")
    return parsed


def _actions(day: str | None, trade_ids: list[str], ask: str) -> list[dict]:
    actions = []
    if trade_ids:
        actions.append({"label": "View Trades", "target": "trades", "href": "/trades?ids=" + ",".join(trade_ids)})
    if day:
        actions.append({"label": "View Day", "target": "day", "href": f"/day?date={day}"})
    actions.append({"label": "Ask TradeFix AI", "target": "chat", "href": "/tradefiz-ai/chat?q=" + ask})
    return actions


def build_market_briefing(context: dict, generate) -> dict:
    symbols = context.get("symbols") or []
    news = context.get("news") or []
    events = context.get("events") or []
    performance = context.get("performance") or {}
    warnings = list(context.get("warnings") or [])
    day = context.get("date")
    findings = []
    metrics = []

    if symbols:
        metrics.append({"label": "Symbols", "value": ", ".join(symbols), "sample_size": len(symbols), "period": day or "session"})

    for group in news:
        headlines = group.get("items") or []
        if not headlines:
            continue
        top = headlines[0]
        findings.append(
            {
                "text": f"{group['symbol']} headline: {top.get('title')}",
                "evidence": [top.get("title") or "", top.get("publisher") or "News", top.get("published") or ""],
                "impact": None,
                "trade_ids": [],
                "confidence": "medium",
                "actions": _actions(day, [], "What did my market briefing say?"),
            }
        )
    for event in events:
        findings.append(
            {
                "text": event["title"],
                "evidence": [f"Impact {event.get('impact') or 'medium'}", event.get("date") or day or ""],
                "impact": event.get("note"),
                "trade_ids": [],
                "confidence": "high",
                "actions": _actions(day, [], "What economic events are on my day plan?"),
            }
        )
    if performance and performance.get("trade_count"):
        pnl = float(performance.get("net_pnl") or 0)
        metrics.append(
            {
                "label": "Recent P&L",
                "value": money(pnl),
                "sample_size": performance["trade_count"],
                "period": "30d",
            }
        )
        rate = performance.get("win_rate")
        evidence = [f"{performance['trade_count']} trades in 30 days", money(pnl)]
        if rate is not None:
            evidence.append(f"Win rate {rate}%")
        findings.append(
            {
                "text": f"Recent results on the selected symbols are {money(pnl)}.",
                "evidence": evidence,
                "impact": money(pnl),
                "trade_ids": [],
                "confidence": "high",
                "actions": _actions(day, [], "Summarize my last 30 days."),
            }
        )

    findings = drop_empty_findings(findings)
    if not findings and not metrics:
        raise OutputRejected("Nothing to analyze. Add symbols or turn on news, events, or recent performance.")

    fallback = findings[0]["text"] if findings else f"Briefing prepared for {', '.join(symbols) or 'your session'}."
    blob = json.dumps({"metrics": metrics, "findings": findings, "warnings": warnings}, default=str)
    parsed = _require_json(generate(SYSTEM, blob))
    summary, extra = grounded_summary(str(parsed.get("summary") or ""), blob, fallback)
    warnings.extend(extra)
    title_day = day or "today"
    return {
        "title": f"Market briefing — {title_day}",
        "summary": summary,
        "metrics": metrics,
        "findings": findings,
        "actions": _actions(day, [], "What did my market briefing say?"),
        "warnings": warnings,
        "changes": [],
    }


def build_session_review(context: dict, generate) -> dict:
    from app.services.ai.agents.logic import session_facts

    trades = context.get("trades") or []
    facts = session_facts(trades)
    day = context.get("date")
    if facts["trade_count"] == 0:
        raise OutputRejected("No trades are logged for this day.")

    trade_ids = [trade["id"] for trade in trades]
    worst = sorted([trade for trade in trades if trade.get("pnl") is not None], key=lambda trade: float(trade["pnl"]))[:3]
    worst_ids = [trade["id"] for trade in worst]
    findings = [
        {
            "text": facts["adherence"],
            "evidence": [
                f"{facts['trade_count']} trades",
                f"{facts['violations']} recorded a broken rule",
            ],
            "impact": None,
            "trade_ids": facts["violation_ids"] or trade_ids,
            "confidence": "high",
            "actions": _actions(day, facts["violation_ids"] or trade_ids, "What did my Session Review find?"),
        },
        {
            "text": facts["playbook"],
            "evidence": [facts["playbook"]],
            "impact": None,
            "trade_ids": facts["playbook_ids"] or trade_ids,
            "confidence": "high",
            "actions": [
                {"label": "View Playbook", "target": "playbooks", "href": "/playbooks"},
                *_actions(day, facts["playbook_ids"] or trade_ids, "Which playbook did I follow today?"),
            ],
        },
    ]
    if worst:
        impact = money(sum(float(trade["pnl"]) for trade in worst))
        findings.append(
            {
                "text": f"Largest losses total {impact}.",
                "evidence": [f"{trade['symbol']} {money(float(trade['pnl']))}" for trade in worst],
                "impact": impact,
                "trade_ids": worst_ids,
                "confidence": "high",
                "actions": _actions(day, worst_ids, "What did my Session Review find?"),
            }
        )
    note = (context.get("journal_note") or "").strip()
    if note:
        findings.append(
            {
                "text": "A journal note is already saved for this day.",
                "evidence": [note[:180]],
                "impact": None,
                "trade_ids": trade_ids,
                "confidence": "medium",
                "actions": _actions(day, trade_ids, "What did my journal say about today?"),
            }
        )
    findings = drop_empty_findings(findings)
    metrics = [
        {"label": "Net P&L", "value": money(facts["net_pnl"]), "sample_size": facts["trade_count"], "period": day},
        {"label": "Trades", "value": str(facts["trade_count"]), "sample_size": facts["trade_count"], "period": day},
    ]
    if facts["win_rate"] is not None:
        metrics.append({"label": "Win rate", "value": f"{facts['win_rate']}%", "sample_size": facts["trade_count"], "period": day})
    metrics.append(
        {
            "label": "Rule adherence",
            "value": facts["adherence"],
            "sample_size": facts["trade_count"],
            "period": day,
        }
    )
    fallback = f"{facts['adherence']}. Net {money(facts['net_pnl'])}."
    blob = json.dumps({"metrics": metrics, "findings": findings, "journal": bool(note)}, default=str)
    parsed = _require_json(generate(SYSTEM, blob))
    summary, extra = grounded_summary(str(parsed.get("summary") or ""), blob, fallback)
    return {
        "title": f"Session review — {day or 'day'}",
        "summary": summary,
        "metrics": metrics,
        "findings": findings,
        "actions": _actions(day, trade_ids, "What did my Session Review find?"),
        "warnings": extra,
        "changes": [],
        "best_decision": findings[-1]["text"] if findings else None,
        "action_labels": ["Review the trades linked in this run"],
    }


def build_trade_tags(context: dict, generate) -> dict:
    from app.services.ai.agents.logic import propose_tags, split_tag_modes

    mode = context.get("mode") or "suggest"
    catalog = context.get("catalog") or []
    instructions = context.get("instructions") or ""
    per_trade = []
    for trade in context.get("trades") or []:
        suggestions = propose_tags(trade, catalog, instructions)
        if not suggestions:
            continue
        per_trade.append({"trade_id": trade["id"], "symbol": trade["symbol"], "suggestions": suggestions})

    if not per_trade:
        raise OutputRejected("No tag suggestions for these trades. Add setup, session, or playbook context first.")

    blob = json.dumps({"mode": mode, "candidates": per_trade}, default=str)
    try:
        raw = generate(SYSTEM, blob)
    except OutputRejected as exc:
        message = str(exc).lower()
        if "not configured" not in message and "not set" not in message:
            raise
        chosen = per_trade
        warnings = ["Tag suggestions used your existing tags because AI is not configured."]
    else:
        parsed = parse_model_json(raw)
        if parsed is None:
            raise OutputRejected("The model returned invalid JSON.")
        chosen = _filter_model_tags(per_trade, parsed.get("trades"))
        summary_seed = ""
        warnings = []
        if isinstance(parsed.get("summary"), str):
            summary_seed = parsed["summary"]
        else:
            summary_seed = ""
        _ = summary_seed

    applied_count = 0
    suggestion_count = 0
    results = []
    for row in chosen:
        apply, suggest = split_tag_modes(row["suggestions"], mode)
        applied_count += len(apply)
        suggestion_count += len(suggest)
        results.append({"trade_id": row["trade_id"], "symbol": row["symbol"], "apply": apply, "suggest": suggest})

    trade_ids = [row["trade_id"] for row in results]
    if mode == "apply":
        summary = f"Tagged {len(results)} trades with {applied_count} tags and {suggestion_count} suggestions."
    else:
        summary = f"Tagged {len(results)} trades with {suggestion_count + applied_count} suggestions."
    findings = []
    for row in results:
        shown = row["apply"] + row["suggest"]
        if not shown:
            continue
        findings.append(
            {
                "text": f"{row['symbol']}: " + ", ".join(item["tag"] for item in shown),
                "evidence": [item["reason"] for item in shown],
                "impact": None,
                "trade_ids": [row["trade_id"]],
                "confidence": shown[0]["confidence"],
                "actions": _actions(None, [row["trade_id"]], "What did the Auto-Tagger identify?"),
            }
        )
    findings = drop_empty_findings(findings)
    return {
        "title": "Trade Auto-Tagger",
        "summary": summary,
        "metrics": [
            {"label": "Trades", "value": str(len(results)), "sample_size": len(results), "period": "import"},
            {"label": "Suggestions", "value": str(suggestion_count + applied_count), "sample_size": len(results), "period": "import"},
        ],
        "findings": findings,
        "actions": _actions(None, trade_ids, "What did the Auto-Tagger identify?"),
        "warnings": warnings,
        "changes": [],
        "tag_results": results,
        "mode": mode,
    }


def _filter_model_tags(candidates: list[dict], model_rows) -> list[dict]:
    if not isinstance(model_rows, list):
        return candidates
    allowed = {}
    for row in candidates:
        allowed[row["trade_id"]] = {_norm(item["tag"]): item for item in row["suggestions"]}
    kept = []
    for row in model_rows:
        if not isinstance(row, dict):
            continue
        trade_id = str(row.get("trade_id") or "")
        pool = allowed.get(trade_id)
        if not pool:
            continue
        suggestions = []
        for item in row.get("suggestions") or []:
            tag = item.get("tag") if isinstance(item, dict) else item
            match = pool.get(_norm(str(tag or "")))
            if match:
                suggestions.append(match)
        if suggestions:
            kept.append({"trade_id": trade_id, "symbol": next(c["symbol"] for c in candidates if c["trade_id"] == trade_id), "suggestions": suggestions})
    return kept or candidates


def _norm(value: str) -> str:
    return " ".join(value.lower().split())
