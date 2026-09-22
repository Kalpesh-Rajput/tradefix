from __future__ import annotations

from app.services.ai.insights.types import Candidate, MAX_INSIGHTS, MIN_EARLY, MIN_STRONG

NEGATIVE = {"leak", "overtrading", "rule", "behavior"}


def confidence_for(n: int, financial: float) -> str:
    if n < MIN_STRONG:
        return "early"
    if n >= 12 and financial >= 0.25:
        return "high"
    return "medium"


def score_candidate(c: Candidate) -> float:
    sample = 1.0 if c.n >= 12 else 0.65 if c.n >= MIN_STRONG else 0.3
    impact = abs(c.financial)
    base = (
        4.0 * impact
        + 1.5 * min(1.0, c.n / 40)
        + 2.0 * sample
        + 1.0 * c.recency
        + 1.5 * c.behavioral
    )
    if c.category in NEGATIVE:
        base += 4.0 * max(impact, c.loss_share or 0)
        if c.category == "leak":
            base += 0.15 * len((c.combo_label or "").split(" · "))
    return base


def _overlaps(existing: Candidate, item: Candidate) -> bool:
    a = (existing.combo_label or existing.detector).lower()
    b = (item.combo_label or item.detector).lower()
    if not a or not b:
        return existing.detector == item.detector and existing.category == item.category
    if a == b:
        return True
    if existing.category == item.category and (a in b or b in a):
        return True
    return False


def rank_candidates(candidates: list[Candidate], total_n: int) -> list[Candidate]:
    if not candidates:
        return []

    scored: list[tuple[float, Candidate]] = []
    for item in candidates:
        if item.n < MIN_EARLY:
            continue
        scored.append((score_candidate(item), item))
    scored.sort(key=lambda row: row[0], reverse=True)

    negatives = [item for _, item in scored if item.category in NEGATIVE]
    edges = [item for _, item in scored if item.category == "edge"]
    rest = [item for _, item in scored if item.category not in NEGATIVE and item.category != "edge"]

    ordered: list[Candidate] = []
    if negatives:
        ordered.append(negatives[0])
    if edges:
        ordered.append(edges[0])
    for item in [row[1] for row in scored]:
        if item not in ordered:
            ordered.append(item)

    picked: list[Candidate] = []
    for item in ordered:
        if len(picked) >= MAX_INSIGHTS:
            break
        if any(_overlaps(prev, item) for prev in picked):
            continue
        picked.append(item)
    return picked
