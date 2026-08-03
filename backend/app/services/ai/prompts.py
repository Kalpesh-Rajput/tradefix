"""Prompt templates for each agent. Every prompt embeds precomputed stats as
JSON-like text so the model is writing prose around real numbers -- it is
explicitly told never to invent figures that aren't given to it.
"""

BASE_SYSTEM_PROMPT = (
    "You are an AI trading coach inside TradeFix, a trading journal app. "
    "You are given precomputed statistics about a trader's own logged trades. "
    "Never invent numbers that are not provided to you. "
    "Be specific, concise, and actionable. Write 2-4 sentences, no bullet points, no markdown, "
    "no disclaimers about not being financial advice unless directly relevant."
)


def morning_brief_prompt(stats: dict) -> str:
    return (
        "Write today's pre-market briefing for this trader.\n\n"
        f"Watchlist: {stats['watchlist']}\n"
        f"Open positions: {stats['open_positions']}\n"
        f"Best setups (last 30 days, by win rate): {stats['top_setups']}\n"
        f"Worst time-of-day window: {stats['worst_hour']}\n"
        f"Current streak: {stats['streak_type']} of {stats['streak_count']}\n\n"
        "Summarize what matters most for today's session in a short, sharp briefing."
    )


def pattern_scout_prompt(stats: dict) -> str:
    return (
        "Scan this trader's setup performance and describe the strongest emerging edge.\n\n"
        f"Setup performance (last 30d vs prior 30d win rate): {stats['setups']}\n\n"
        "Identify which setup is trending up the most and explain why it's worth leaning into right now, "
        "using only the numbers given."
    )


def risk_contribution_prompt(stats: dict) -> str:
    return (
        "Review this trader's current risk exposure.\n\n"
        f"Open position concentration: {stats['concentration']}\n"
        f"Consecutive losses: {stats['consecutive_losses']}\n"
        f"Worst single day P&L on record: {stats['worst_day_pnl']}\n\n"
        "Flag any concentration or drawdown risk using only the numbers given. If nothing looks risky, say so briefly."
    )


def hot_take_prompt(stats: dict) -> str:
    return (
        "Give one bold, opinionated trading thesis based on this trader's own historical performance data.\n\n"
        f"Overview: {stats['overview']}\n"
        f"Best setup: {stats['best_setup']}\n"
        f"Worst setup: {stats['worst_setup']}\n\n"
        "Make it a single strong claim framed as a conversation starter, not a directive. "
        "Base it only on the data given."
    )


def journal_pulse_prompt(stats: dict) -> str:
    return (
        "Summarize the relationship between this trader's mood check-ins and their P&L.\n\n"
        f"Mood vs P&L buckets (1=worst mood, 5=best mood): {stats['mood_vs_pnl']}\n\n"
        "Explain in plain terms what mental state seems to correlate with their best and worst outcomes, "
        "using only the numbers given."
    )
