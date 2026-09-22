from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from app.services.ai.insights import copy as templates
from app.services.ai.insights.cohorts import (
    avg_r,
    cohort_metrics,
    group_by,
    hour_of,
    loss_pnl,
    opened_at,
    pnl_of,
    recency_share,
    session_of,
    setup_of,
    side_of,
    symbol_of,
    trade_id,
)
from app.services.ai.insights.rank import confidence_for
from app.services.ai.insights.types import Candidate, MIN_EARLY, MIN_STRONG
from app.services.ai.insights.cohorts import r_multiple


def _ids(trades: list) -> list[str]:
    return [trade_id(t) for t in trades]


def _filter(trades: list, **fields) -> dict:
    payload = {"ids": _ids(trades)}
    for key, value in fields.items():
        if value not in (None, "", []):
            payload[key] = value
    return payload


def _loss_share(group: list, universe: list) -> float:
    total = abs(loss_pnl(universe))
    if total <= 0:
        return 0.0
    return abs(loss_pnl(group)) / total


def detect_combos(trades: list) -> list[Candidate]:
    if len(trades) < MIN_EARLY:
        return []
    universe = cohort_metrics(trades)
    universe_r = universe["avg_r"]
    total_loss = abs(loss_pnl(trades))

    dim_fns = {
        "setup": setup_of,
        "symbol": symbol_of,
        "session": session_of,
        "side": side_of,
        "hour": hour_of,
    }
    singles: list[tuple[str, str, list, dict]] = []
    for dim in ("setup", "symbol", "session"):
        for key, group in group_by(trades, dim_fns[dim]).items():
            if len(group) >= MIN_EARLY:
                singles.append((dim, key, group, {dim if dim != "setup" else "setup_tag": key}))

    pair_specs = [
        ("setup", "session"),
        ("setup", "symbol"),
        ("symbol", "session"),
        ("setup", "side"),
        ("setup", "hour"),
        ("symbol", "hour"),
    ]
    pairs: list[tuple[str, str, list, dict]] = []
    for a, b in pair_specs:
        buckets: dict[tuple[str, str], list] = defaultdict(list)
        for trade in trades:
            ka, kb = dim_fns[a](trade), dim_fns[b](trade)
            if ka and kb:
                buckets[(str(ka), str(kb))].append(trade)
        for (ka, kb), group in buckets.items():
            if len(group) >= MIN_EARLY:
                filt = {}
                if a == "setup":
                    filt["setup_tag"] = ka
                else:
                    filt[a] = ka
                if b == "setup":
                    filt["setup_tag"] = kb
                else:
                    filt[b] = kb
                pairs.append((f"{a}+{b}", f"{ka} · {kb}", group, filt))

    triples: list[tuple[str, str, list, dict]] = []
    for a, b, c in (("setup", "symbol", "session"), ("setup", "session", "hour")):
        buckets = defaultdict(list)
        for trade in trades:
            keys = (dim_fns[a](trade), dim_fns[b](trade), dim_fns[c](trade))
            if all(keys):
                buckets[tuple(str(k) for k in keys)].append(trade)
        for keys, group in buckets.items():
            if len(group) >= MIN_EARLY:
                ka, kb, kc = keys
                filt = {"setup_tag": ka} if a == "setup" else {a: ka}
                filt[b if b != "setup" else "setup_tag"] = kb
                filt[c] = kc
                triples.append((f"{a}+{b}+{c}", f"{ka} · {kb} · {kc}", group, filt))

    parent_loss = {label: abs(loss_pnl(group)) for _, label, group, _ in singles}

    def concentrated(label: str, group: list, parts: list[str]) -> bool:
        child_loss = abs(loss_pnl(group))
        for part in parts:
            parent = parent_loss.get(part)
            if parent and parent > 0 and child_loss / parent >= 0.4:
                return True
        if len(parts) <= 1:
            return True
        return False

    out: list[Candidate] = []
    seen: set[str] = set()

    def consider(kind: str, label: str, group: list, filt: dict, detector: str, parts: list[str]) -> None:
        stats = cohort_metrics(group)
        n = stats["n"]
        share = _loss_share(group, trades)
        conf = confidence_for(n, share)
        rec = recency_share(group, trades)
        avg = stats["avg_r"]
        worse = avg is not None and universe_r is not None and avg < universe_r - 0.15
        better = avg is not None and universe_r is not None and avg > universe_r + 0.15
        if avg is None:
            worse = stats["pnl"] < 0 and share >= 0.2
            better = stats["win_rate"] >= universe["win_rate"] + 10 and stats["pnl"] > 0

        is_leak = stats["pnl"] < 0 and (share >= 0.22 or (n >= MIN_STRONG and worse))
        if is_leak and kind == "single" and detector in {"symbol", "session_only"} and n / max(len(trades), 1) >= 0.65:
            is_leak = False
        is_edge = stats["pnl"] > 0 and n >= MIN_EARLY and (better or stats["win_rate"] >= 58)

        if is_leak and (kind == "single" or concentrated(label, group, parts)):
            key = f"leak:{label}"
            if key in seen:
                return
            seen.add(key)
            text = templates.leak_copy(label, stats, share, conf)
            category = "leak"
            out.append(
                Candidate(
                    category=category,
                    detector=detector,
                    title=text["title"],
                    explanation=text["explanation"],
                    evidence=text["evidence"],
                    why_narrative=text["why"],
                    n=n,
                    matching_trades=n,
                    losses=stats["losses"],
                    loss_share=share,
                    metrics=text["metrics"],
                    trade_ids=stats["ids"],
                    trade_filter=_filter(group, **{k: v for k, v in filt.items() if k != "hour"}),
                    ask_question=text["ask"],
                    primary_action_label=text["action"],
                    financial=share * (1.0 - 0.5 * (n / max(len(trades), 1))) if total_loss else min(1.0, abs(stats["pnl"]) / 500),
                    recency=rec,
                    combo_label=label,
                    extra={"setup": filt.get("setup_tag"), "symbol": filt.get("symbol"), "session": filt.get("session")},
                )
            )
        elif is_edge:
            key = f"edge:{label}"
            if key in seen:
                return
            if len(parts) > 1 and not concentrated(label, group, parts) and share < 0.15:
                profit_share = profit_share_of(group, trades)
                if profit_share < 0.3:
                    return
            seen.add(key)
            text = templates.edge_copy(label, stats, conf)
            category = "edge"
            profit_share = profit_share_of(group, trades)
            out.append(
                Candidate(
                    category=category,
                    detector=detector,
                    title=text["title"],
                    explanation=text["explanation"],
                    evidence=text["evidence"],
                    why_narrative=text["why"],
                    n=n,
                    matching_trades=n,
                    losses=stats["losses"],
                    loss_share=None,
                    metrics=text["metrics"],
                    trade_ids=stats["ids"],
                    trade_filter=_filter(group, **{k: v for k, v in filt.items() if k != "hour"}),
                    ask_question=text["ask"],
                    primary_action_label=text["action"],
                    financial=profit_share,
                    recency=rec,
                    combo_label=label,
                )
            )

    for dim, label, group, filt in singles:
        consider("single", label, group, filt, f"{dim}_only" if dim == "session" else dim, [label])
    for det, label, group, filt in pairs:
        parts = label.split(" · ")
        consider("pair", label, group, filt, det, parts)
    for det, label, group, filt in triples:
        parts = label.split(" · ")
        consider("triple", label, group, filt, det, parts)
    return out


def profit_share_of(group: list, universe: list) -> float:
    total = sum(pnl_of(t) for t in universe if pnl_of(t) > 0)
    if total <= 0:
        return 0.0
    return max(0.0, sum(pnl_of(t) for t in group if pnl_of(t) > 0) / total)


def detect_behavior(trades: list) -> list[Candidate]:
    ordered = sorted([t for t in trades if opened_at(t)], key=lambda t: opened_at(t))
    if len(ordered) < MIN_STRONG:
        return []

    by_day: dict = defaultdict(list)
    for trade in ordered:
        stamp = opened_at(trade)
        if stamp is None:
            continue
        by_day[stamp.date()].append(trade)

    loss_day_counts: list[int] = []
    clean_day_counts: list[int] = []
    follow_loss: list = []
    for group in by_day.values():
        group = sorted(group, key=opened_at)
        first_loss = next((i for i, t in enumerate(group) if pnl_of(t) < 0), None)
        if first_loss is None:
            clean_day_counts.append(len(group))
            continue
        loss_day_counts.append(len(group))
        follow_loss.extend(group[first_loss + 1 :])

    if len(loss_day_counts) < 3 or not clean_day_counts:
        return []
    avg_after = sum(loss_day_counts) / len(loss_day_counts)
    avg_base = sum(clean_day_counts) / len(clean_day_counts)
    if avg_base <= 0 or avg_after < avg_base * 1.35 or avg_after < 1.5:
        return []

    follow_r = avg_r(follow_loss)
    if follow_r is not None and follow_r >= 0 and pnl_of_avg(follow_loss) >= 0:
        return []

    text = templates.behavior_copy(avg_after, avg_base, follow_r, len(loss_day_counts))
    n = len(follow_loss) or len(loss_day_counts)
    return [
        Candidate(
            category="behavior",
            detector="post_loss",
            title=text["title"],
            explanation=text["explanation"],
            evidence=text["evidence"],
            why_narrative=text["why"],
            n=max(n, len(loss_day_counts)),
            matching_trades=len(follow_loss),
            losses=sum(1 for t in follow_loss if pnl_of(t) < 0),
            loss_share=_loss_share(follow_loss, trades) if follow_loss else None,
            metrics=text["metrics"],
            trade_ids=_ids(follow_loss or ordered),
            trade_filter=_filter(follow_loss or ordered),
            ask_question=text["ask"],
            primary_action_label=text["action"],
            financial=_loss_share(follow_loss, trades) if follow_loss else 0.2,
            recency=recency_share(follow_loss or ordered, trades),
            behavioral=1.0,
            suggested_rule=text["suggested_rule"],
            suggested_action=text["suggested_action"],
        )
    ]


def pnl_of_avg(trades: list) -> float:
    if not trades:
        return 0.0
    return sum(pnl_of(t) for t in trades) / len(trades)


def detect_rules(trades: list, max_loss: float | None = None) -> list[Candidate]:
    broken = []
    for trade in trades:
        tags = list(getattr(trade, "rules_broken", None) or [])
        flags = list(getattr(trade, "auto_flags", None) or [])
        over_risk = False
        if max_loss is not None and max_loss > 0 and pnl_of(trade) < 0 and abs(pnl_of(trade)) > max_loss:
            over_risk = True
        if tags or over_risk or "revenge_trading" in flags:
            broken.append(trade)
    if len(broken) < MIN_EARLY:
        return []

    ordered = sorted([t for t in trades if opened_at(t)], key=lambda t: opened_at(t) or 0)
    after_streak = 0
    streak = 0
    broken_ids = {trade_id(t) for t in broken}
    for trade in ordered:
        if pnl_of(trade) < 0:
            streak += 1
        else:
            streak = 0
        if trade_id(trade) in broken_ids and streak >= 2:
            after_streak += 1

    losses = [t for t in broken if pnl_of(t) < 0]
    text = templates.rule_copy(len(broken), len(losses), avg_r(losses), after_streak >= 2)
    n = len(broken)
    share = _loss_share(broken, trades)
    conf = confidence_for(n, share)
    category = "rule"
    return [
        Candidate(
            category=category,
            detector="rules_broken",
            title=text["title"],
            explanation=text["explanation"],
            evidence=text["evidence"],
            why_narrative=text["why"],
            n=n,
            matching_trades=n,
            losses=len(losses),
            loss_share=share,
            metrics=text["metrics"],
            trade_ids=_ids(broken),
            trade_filter=_filter(broken, has_rules_broken=True),
            ask_question=text["ask"],
            primary_action_label=text["action"],
            financial=max(share, 0.15),
            recency=recency_share(broken, trades),
            behavioral=1.0,
            suggested_rule=text["suggested_rule"],
            suggested_action=text["suggested_action"],
        )
    ]


def detect_change(trades: list, now=None) -> list[Candidate]:
    stamps = [opened_at(t) for t in trades]
    stamps = [s for s in stamps if s is not None]
    if not stamps:
        return []
    latest = now or max(stamps)
    current_start = latest - timedelta(days=30)
    prior_start = latest - timedelta(days=60)
    current = [t for t in trades if opened_at(t) and opened_at(t) >= current_start]
    prior = [t for t in trades if opened_at(t) and prior_start <= opened_at(t) < current_start]
    if len(current) < MIN_EARLY or len(prior) < MIN_EARLY:
        return []

    def avg_loss_r(group: list) -> float | None:
        values = [r_multiple(t) for t in group if pnl_of(t) < 0]
        values = [v for v in values if v is not None]
        if values:
            return round(sum(values) / len(values), 3)
        losses = [pnl_of(t) for t in group if pnl_of(t) < 0]
        if not losses:
            return None
        return round(sum(losses) / len(losses), 3)

    prev_r = avg_loss_r(prior)
    curr_r = avg_loss_r(current)
    if prev_r is None or curr_r is None:
        return []
    delta = curr_r - prev_r
    if abs(delta) < 0.15:
        return []
    improved = curr_r > prev_r
    text = templates.change_copy(prev_r, curr_r, improved, len(prior), len(current))
    n = len(current)
    conf = confidence_for(n, abs(delta))
    category = "change"
    return [
        Candidate(
            category=category,
            detector="period_change",
            title=text["title"],
            explanation=text["explanation"],
            evidence=text["evidence"],
            why_narrative=text["why"],
            n=n,
            matching_trades=n,
            losses=sum(1 for t in current if pnl_of(t) < 0),
            loss_share=None,
            metrics=text["metrics"],
            trade_ids=_ids(current),
            trade_filter=_filter(
                current,
                date_from=current_start.date().isoformat(),
                date_to=latest.date().isoformat(),
            ),
            ask_question=text["ask"],
            primary_action_label=text["action"],
            financial=min(1.0, abs(delta)),
            recency=1.0,
        )
    ]


def detect_overtrading(trades: list, now=None) -> list[Candidate]:
    stamps = [opened_at(t) for t in trades if opened_at(t)]
    if not stamps:
        return []
    latest = now or max(stamps)
    week_start = latest - timedelta(days=7)
    this_week = [t for t in trades if opened_at(t) and opened_at(t) >= week_start]
    if len(this_week) < MIN_STRONG:
        return []

    weeks: dict[int, list] = defaultdict(list)
    for trade in trades:
        stamp = opened_at(trade)
        if stamp is None or stamp >= week_start:
            continue
        delta_days = (latest.date() - stamp.date()).days
        bucket = delta_days // 7
        if 1 <= bucket <= 4:
            weeks[bucket].append(trade)
    if len(weeks) < 2:
        return []
    if sum(len(v) for v in weeks.values()) < MIN_STRONG:
        return []
    baseline_counts = [len(v) for v in weeks.values()]
    avg_count = sum(baseline_counts) / len(baseline_counts)
    if avg_count <= 0:
        return []
    count_pct = (len(this_week) - avg_count) / avg_count * 100
    if count_pct < 25:
        return []

    def exp_of(group: list) -> float:
        r = avg_r(group)
        if r is not None:
            return r
        return pnl_of_avg(group)

    base_groups = [g for g in weeks.values() if g]
    base_exp = sum(exp_of(g) for g in base_groups) / len(base_groups)
    week_exp = exp_of(this_week)
    if base_exp == 0:
        exp_pct = 0.0 if week_exp == 0 else (-100.0 if week_exp < 0 else 100.0)
    else:
        exp_pct = (week_exp - base_exp) / abs(base_exp) * 100

    def adherence(group: list) -> float:
        if not group:
            return 0.0
        clean = sum(1 for t in group if not list(getattr(t, "rules_broken", None) or []))
        return clean / len(group) * 100

    base_ad = sum(adherence(g) for g in base_groups) / len(base_groups)
    week_ad = adherence(this_week)
    adhere_pct = week_ad - base_ad
    if exp_pct > -8:
        return []

    flags = [t for t in this_week if "overtrading" in list(getattr(t, "auto_flags", None) or [])]
    text = templates.overtrading_copy(count_pct, exp_pct, adhere_pct, len(this_week))
    n = len(this_week)
    conf = confidence_for(n, min(1.0, count_pct / 100))
    category = "overtrading"
    group = flags or this_week
    return [
        Candidate(
            category=category,
            detector="overtrading",
            title=text["title"],
            explanation=text["explanation"],
            evidence=text["evidence"],
            why_narrative=text["why"],
            n=n,
            matching_trades=n,
            losses=sum(1 for t in this_week if pnl_of(t) < 0),
            loss_share=_loss_share(this_week, trades),
            metrics=text["metrics"],
            trade_ids=_ids(group),
            trade_filter=_filter(
                group,
                date_from=week_start.date().isoformat(),
                date_to=latest.date().isoformat(),
                auto_flag="overtrading" if flags else None,
            ),
            ask_question=text["ask"],
            primary_action_label=text["action"],
            financial=max(_loss_share(this_week, trades), min(1.0, count_pct / 80)),
            recency=1.0,
            behavioral=1.0,
            suggested_rule=text["suggested_rule"],
            suggested_action=text["suggested_action"],
        )
    ]


def detect_all(trades: list, *, max_loss: float | None = None, now=None) -> list[Candidate]:
    found: list[Candidate] = []
    found.extend(detect_combos(trades))
    found.extend(detect_behavior(trades))
    found.extend(detect_rules(trades, max_loss=max_loss))
    found.extend(detect_change(trades, now=now))
    found.extend(detect_overtrading(trades, now=now))
    return found
