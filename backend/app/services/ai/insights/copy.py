from __future__ import annotations

from app.services.ai.insights.cohorts import fmt_pct, fmt_r


def leak_copy(label: str, stats: dict, loss_share: float, confidence: str) -> dict:
    wr = stats["win_rate"]
    n = stats["n"]
    avg_r = stats["avg_r"]
    share_pct = round(loss_share * 100)
    if confidence == "early":
        title = "Early pattern in a losing combination"
        explanation = (
            f"{label} has underperformed recently, but the sample size is still small."
        )
        evidence = "Continue collecting data before drawing a strong conclusion."
        why = (
            f"TradeFix identified this from {n} trades. "
            f"{stats['losses']} were losses. Treat this as an early signal, not a verdict."
        )
    else:
        title = "Your biggest losses are coming from one specific combination."
        explanation = f"Your biggest losses are concentrated in {label}."
        evidence = f"These trades account for {share_pct}% of your total losses in this period."
        why = (
            f"TradeFix identified this pattern from {n} trades. "
            f"{stats['losses']} resulted in losses. "
            f"Those losses represent {share_pct}% of your total losses during this period."
        )
    return {
        "title": title,
        "explanation": explanation,
        "evidence": evidence,
        "why": why,
        "ask": f"Why is my {label} combination performing poorly?",
        "action": "View Trades",
        "metrics": [
            {"label": "Setup", "value": label, "tone": None},
            {"label": "Trades", "value": str(n), "tone": None},
            {"label": "Win Rate", "value": fmt_pct(wr), "tone": "neg" if wr < 50 else "neutral"},
            {"label": "Average Result", "value": fmt_r(avg_r), "tone": "neg" if (avg_r or 0) < 0 else "pos"},
        ],
    }


def edge_copy(label: str, stats: dict, confidence: str) -> dict:
    wr = stats["win_rate"]
    n = stats["n"]
    avg_r = stats["avg_r"]
    if confidence == "early":
        title = "Early edge signal"
        explanation = f"{label} is outperforming your other combinations, but the sample is still small."
        evidence = "Keep logging trades here before treating this as a confirmed edge."
    else:
        title = "Your strongest edge"
        explanation = f"{label} is currently performing better than your other trading combinations."
        evidence = f"Your strongest results come from {label} — {fmt_pct(wr)} win rate across {n} trades."
    why = (
        f"TradeFix compared this combination against your other tagged trades. "
        f"{n} trades matched {label}, with a {fmt_pct(wr)} win rate"
        f"{f' and {fmt_r(avg_r)} expectancy' if avg_r is not None else ''}."
    )
    return {
        "title": title,
        "explanation": explanation,
        "evidence": evidence,
        "why": why,
        "ask": f"Why is {label} performing better than my others?",
        "action": "Explore Setup",
        "metrics": [
            {"label": "Win Rate", "value": fmt_pct(wr), "tone": "pos"},
            {"label": "Expectancy", "value": fmt_r(avg_r), "tone": "pos" if (avg_r or 0) >= 0 else "neg"},
            {"label": "Trades", "value": str(n), "tone": None},
        ],
    }


def behavior_copy(after_loss: float, baseline: float, follow_exp: float | None, n: int) -> dict:
    ratio = after_loss / baseline if baseline else 0
    title = "Trading pattern detected"
    explanation = "You tend to take more trades after a losing trade."
    evidence = (
        f"This behavior has produced a negative expectancy in your recent history."
        if (follow_exp or 0) < 0
        else f"Follow-up trades after losses have {fmt_r(follow_exp)} expectancy."
    )
    why = (
        f"After a loss you average {after_loss:.1f} next trades, versus {baseline:.1f} normally. "
        f"That is {ratio:.1f}× your baseline across {n} sequences."
    )
    return {
        "title": title,
        "explanation": explanation,
        "evidence": evidence,
        "why": why,
        "ask": "Why do I perform worse when I take more trades after a loss?",
        "action": "Review Pattern",
        "suggested_action": "Limit yourself to one additional trade after a loss.",
        "suggested_rule": "Take at most one additional trade after a loss",
        "metrics": [
            {"label": "After a loss", "value": f"{after_loss:.1f} next trades", "tone": "neg"},
            {"label": "Normal", "value": f"{baseline:.1f} trades", "tone": None},
        ],
    }


def rule_copy(violations: int, related_losses: int, avg_r: float | None, after_streak: bool) -> dict:
    if after_streak:
        explanation = "You frequently break your maximum-risk rule after consecutive losses."
        ask = "Show me the impact of my rule violations after losing streaks."
    else:
        explanation = "Rule breaks are clustering on losing trades."
        ask = "Show me the impact of my rule violations."
    evidence = (
        f"{related_losses} of those violations were also losses"
        f"{f', averaging {fmt_r(avg_r)}' if avg_r is not None else ''}."
    )
    why = (
        f"TradeFix found {violations} trades tagged with a broken rule. "
        f"{related_losses} of them lost money."
    )
    return {
        "title": "Rule breach pattern",
        "explanation": explanation,
        "evidence": evidence,
        "why": why,
        "ask": ask,
        "action": "Review Violations",
        "suggested_action": "Stop trading for the day after two consecutive losses.",
        "suggested_rule": "Stop after two consecutive losses",
        "metrics": [
            {"label": "Rule violations", "value": str(violations), "tone": "neg"},
            {"label": "Related losses", "value": str(related_losses), "tone": "neg"},
            {"label": "Average loss", "value": fmt_r(avg_r), "tone": "neg"},
        ],
    }


def change_copy(prev_r: float | None, curr_r: float | None, improved: bool, n_prev: int, n_curr: int) -> dict:
    if improved:
        explanation = "Your average losing trade has decreased over the last 30 days."
        evidence = "Your risk management appears to be tightening versus the prior period."
        title = "Performance changed"
        ask = "How has my risk management improved recently?"
        action = "See Improvement"
    else:
        explanation = "Your average losing trade has increased over the last 30 days."
        evidence = "Loss size is expanding versus the prior period."
        title = "Performance changed"
        ask = "Why have my losing trades gotten larger?"
        action = "See Change"
    why = (
        f"TradeFix compared {n_curr} trades in the last 30 days with {n_prev} in the prior 30 days. "
        f"Average losing trade moved from {fmt_r(prev_r)} to {fmt_r(curr_r)}."
    )
    return {
        "title": title,
        "explanation": explanation,
        "evidence": evidence,
        "why": why,
        "ask": ask,
        "action": action,
        "metrics": [
            {"label": "Previous period", "value": fmt_r(prev_r), "tone": "neg"},
            {"label": "Current period", "value": fmt_r(curr_r), "tone": "pos" if improved else "neg"},
        ],
    }


def overtrading_copy(count_pct: float, exp_pct: float, adhere_pct: float, n: int) -> dict:
    explanation = (
        "You traded significantly more frequently this week, but your average trade quality decreased."
    )
    evidence = (
        f"Trade count {fmt_pct(count_pct, signed=True)} while expectancy "
        f"{fmt_pct(exp_pct, signed=True)} and rule adherence {fmt_pct(adhere_pct, signed=True)}."
    )
    why = (
        f"This week includes {n} trades. Frequency rose {fmt_pct(count_pct, signed=True)} "
        f"versus your recent weekly baseline, while expectancy fell {fmt_pct(exp_pct, signed=True)}."
    )
    return {
        "title": "Overtrading detected",
        "explanation": explanation,
        "evidence": evidence,
        "why": why,
        "ask": "Why do I perform worse when I take more trades?",
        "action": "Analyse This Week",
        "suggested_action": "Cap daily trades at your typical weekday count.",
        "suggested_rule": "Do not exceed my typical daily trade count",
        "metrics": [
            {"label": "Trades", "value": fmt_pct(count_pct, signed=True), "tone": "neg" if count_pct > 0 else "pos"},
            {"label": "Expectancy", "value": fmt_pct(exp_pct, signed=True), "tone": "neg" if exp_pct < 0 else "pos"},
            {"label": "Rule adherence", "value": fmt_pct(adhere_pct, signed=True), "tone": "neg" if adhere_pct < 0 else "pos"},
        ],
    }


def news_copy(symbol: str, headline: str, n: int, wr: float) -> dict:
    explanation = f"You traded {symbol} around relevant market news."
    evidence = f"Your last {n} trades taken near these headlines have a {fmt_pct(wr)} win rate."
    why = (
        f"TradeFix matched {n} {symbol} trades to published headlines, including “{headline}”. "
        f"Those trades won {fmt_pct(wr)} of the time."
    )
    return {
        "title": "News context",
        "explanation": explanation,
        "evidence": evidence,
        "why": why,
        "ask": f"How does news around {symbol} affect my results?",
        "action": "View Related News",
        "metrics": [
            {"label": "Symbol", "value": symbol, "tone": None},
            {"label": "Trades near news", "value": str(n), "tone": None},
            {"label": "Win Rate", "value": fmt_pct(wr), "tone": "neg" if wr < 45 else "neutral"},
        ],
    }


def summary_template(parts: list[str], attention: int) -> str:
    intro = "I reviewed your recent trading activity."
    if not parts:
        return intro
    if attention:
        intro = f"I found {attention} thing{'s' if attention != 1 else ''} worth your attention."
    return " ".join([intro, *parts])
