from __future__ import annotations

import math
import re
import uuid
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ai_document import AiDocument


@dataclass
class SearchHit:
    source_type: str
    source_id: uuid.UUID
    content: str
    metadata: dict
    score: float


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for a, b in zip(left, right):
        dot += a * b
        left_norm += a * a
        right_norm += b * b
    if left_norm <= 0 or right_norm <= 0:
        return 0.0
    return dot / math.sqrt(left_norm * right_norm)


def upsert_document(
    db: Session,
    *,
    user_id: uuid.UUID,
    source_type: str,
    source_id: uuid.UUID,
    content: str,
    content_hash: str,
    embedding: list[float] | None,
    metadata: dict,
) -> None:
    values = {
        "id": uuid.uuid4(),
        "user_id": user_id,
        "source_type": source_type,
        "source_id": source_id,
        "content": content,
        "content_hash": content_hash,
        "embedding": embedding,
        "metadata": metadata or {},
    }
    stmt = insert(AiDocument).values(**values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_ai_documents_user_source",
        set_={
            "content": content,
            "content_hash": content_hash,
            "embedding": embedding,
            "metadata": metadata or {},
        },
    )
    db.execute(stmt)


def delete_document(db: Session, user_id: uuid.UUID, source_type: str, source_id: uuid.UUID) -> None:
    row = db.scalar(
        select(AiDocument).where(
            AiDocument.user_id == user_id,
            AiDocument.source_type == source_type,
            AiDocument.source_id == source_id,
        )
    )
    if row is not None:
        db.delete(row)


def existing_hash(db: Session, user_id: uuid.UUID, source_type: str, source_id: uuid.UUID) -> str | None:
    row = db.scalar(
        select(AiDocument.content_hash).where(
            AiDocument.user_id == user_id,
            AiDocument.source_type == source_type,
            AiDocument.source_id == source_id,
        )
    )
    return row


def indexed_source_ids(db: Session, user_id: uuid.UUID, source_type: str) -> set[uuid.UUID]:
    rows = db.scalars(
        select(AiDocument.source_id).where(
            AiDocument.user_id == user_id,
            AiDocument.source_type == source_type,
        )
    ).all()
    return set(rows)


def search_documents(
    db: Session,
    *,
    user_id: uuid.UUID,
    query: str,
    source_types: tuple[str, ...] | list[str],
    query_embedding: list[float] | None = None,
    top_k: int | None = None,
) -> list[SearchHit]:
    limit = top_k or settings.ai_max_context_documents
    stmt = select(AiDocument).where(
        AiDocument.user_id == user_id,
        AiDocument.source_type.in_(tuple(source_types)),
    )
    tokens = _query_tokens(query)
    if tokens:
        like_filters = [AiDocument.content.ilike(f"%{token}%") for token in tokens[:6]]
        if like_filters:
            stmt = stmt.where(or_(*like_filters))
    rows = list(db.scalars(stmt.limit(250)).all())
    if not rows and tokens:
        rows = list(
            db.scalars(
                select(AiDocument)
                .where(
                    AiDocument.user_id == user_id,
                    AiDocument.source_type.in_(tuple(source_types)),
                )
                .limit(250)
            ).all()
        )
    scored: list[SearchHit] = []
    for row in rows:
        lexical = _lexical_score(row.content or "", tokens)
        vector = 0.0
        if query_embedding and isinstance(row.embedding, list) and row.embedding:
            vector = cosine_similarity(query_embedding, [float(v) for v in row.embedding])
        score = (0.65 * vector + 0.35 * lexical) if query_embedding else lexical
        if score <= 0 and not tokens:
            continue
        scored.append(
            SearchHit(
                source_type=row.source_type,
                source_id=row.source_id,
                content=row.content,
                metadata=dict(row.metadata_json or {}),
                score=round(float(score), 4),
            )
        )
    scored.sort(key=lambda hit: hit.score, reverse=True)
    return scored[:limit]


def _query_tokens(query: str) -> list[str]:
    return [token for token in re.findall(r"[A-Za-z0-9]{3,}", query.lower()) if token not in _STOP]


_STOP = {
    "the",
    "and",
    "for",
    "with",
    "what",
    "why",
    "how",
    "are",
    "was",
    "were",
    "this",
    "that",
    "from",
    "your",
    "mine",
    "have",
    "has",
    "did",
    "does",
    "about",
    "into",
    "over",
    "my",
    "me",
}


def _lexical_score(content: str, tokens: list[str]) -> float:
    if not tokens:
        return 0.0
    hay = content.lower()
    hits = sum(1 for token in tokens if token in hay)
    return hits / len(tokens)
