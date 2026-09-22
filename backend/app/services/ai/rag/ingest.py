from __future__ import annotations

import hashlib
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.daily_checkin import DailyCheckin
from app.models.daily_recap import DailyRecap
from app.models.day_note import DayNote
from app.models.mentor import TradeComment
from app.models.mood import MoodCheckin
from app.models.playbook import Playbook
from app.models.trade import Trade
from app.services.ai.embeddings.openrouter import OpenRouterEmbeddingProvider
from app.services.ai.rag import documents as doc_builders
from app.services.ai.rag import store as doc_store

logger = logging.getLogger(__name__)

_embedder = OpenRouterEmbeddingProvider()


def _hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _upsert(
    db: Session,
    user_id: uuid.UUID,
    source_type: str,
    source_id: uuid.UUID,
    payload: tuple[str, dict] | None,
) -> None:
    if payload is None:
        doc_store.delete_document(db, user_id, source_type, source_id)
        return
    content, metadata = payload
    digest = _hash(content)
    previous = doc_store.existing_hash(db, user_id, source_type, source_id)
    embedding = None
    if previous == digest:
        return
    if _embedder.is_configured():
        vectors = _embedder.embed([content[:8000]])
        embedding = vectors[0] if vectors else None
    doc_store.upsert_document(
        db,
        user_id=user_id,
        source_type=source_type,
        source_id=source_id,
        content=content,
        content_hash=digest,
        embedding=embedding,
        metadata=metadata,
    )


def ingest_day_note(db: Session, note: DayNote) -> None:
    _upsert(db, note.user_id, "day_note", note.id, doc_builders.day_note_document(note))


def ingest_recap(db: Session, recap: DailyRecap) -> None:
    _upsert(db, recap.user_id, "daily_recap", recap.id, doc_builders.recap_document(recap))


def ingest_checkin(db: Session, row: DailyCheckin) -> None:
    _upsert(db, row.user_id, "daily_checkin", row.id, doc_builders.checkin_document(row))


def ingest_mood(db: Session, row: MoodCheckin) -> None:
    _upsert(db, row.user_id, "mood_checkin", row.id, doc_builders.mood_document(row))


def ingest_trade(db: Session, trade: Trade) -> None:
    _upsert(db, trade.user_id, "trade_note", trade.id, doc_builders.trade_note_document(trade))


def ingest_playbook(db: Session, playbook: Playbook) -> None:
    _upsert(db, playbook.user_id, "playbook", playbook.id, doc_builders.playbook_document(playbook))


def ingest_trade_comment(db: Session, comment: TradeComment, trade: Trade | None = None) -> None:
    if trade is None:
        trade = db.get(Trade, comment.trade_id)
    if trade is None:
        return
    _upsert(db, trade.user_id, "trade_comment", comment.id, doc_builders.trade_comment_document(comment, trade))


def safe_ingest(db: Session, fn) -> None:
    try:
        fn()
        db.commit()
    except Exception:
        logger.exception("AI document ingest failed")
        db.rollback()


def backfill_user_documents(db: Session, user_id: uuid.UUID) -> int:
    """Idempotent lazy index of the authenticated user's journal corpus."""
    created = 0
    notes = db.scalars(select(DayNote).where(DayNote.user_id == user_id)).all()
    indexed = doc_store.indexed_source_ids(db, user_id, "day_note")
    for note in notes:
        if note.id in indexed:
            continue
        ingest_day_note(db, note)
        created += 1

    recaps = db.scalars(select(DailyRecap).where(DailyRecap.user_id == user_id)).all()
    indexed = doc_store.indexed_source_ids(db, user_id, "daily_recap")
    for recap in recaps:
        if recap.id in indexed:
            continue
        ingest_recap(db, recap)
        created += 1

    checkins = db.scalars(select(DailyCheckin).where(DailyCheckin.user_id == user_id)).all()
    indexed = doc_store.indexed_source_ids(db, user_id, "daily_checkin")
    for row in checkins:
        if row.id in indexed:
            continue
        ingest_checkin(db, row)
        created += 1

    moods = db.scalars(select(MoodCheckin).where(MoodCheckin.user_id == user_id)).all()
    indexed = doc_store.indexed_source_ids(db, user_id, "mood_checkin")
    for row in moods:
        if row.id in indexed:
            continue
        ingest_mood(db, row)
        created += 1

    trades = db.scalars(select(Trade).where(Trade.user_id == user_id, Trade.is_deleted.is_(False))).all()
    indexed_notes = doc_store.indexed_source_ids(db, user_id, "trade_note")
    for trade in trades:
        if trade.id in indexed_notes:
            continue
        if not (trade.notes or trade.voice_transcript):
            continue
        ingest_trade(db, trade)
        created += 1

    playbooks = db.scalars(select(Playbook).where(Playbook.user_id == user_id, Playbook.is_archived.is_(False))).all()
    indexed = doc_store.indexed_source_ids(db, user_id, "playbook")
    for playbook in playbooks:
        if playbook.id in indexed:
            continue
        ingest_playbook(db, playbook)
        created += 1

    trade_ids = [trade.id for trade in trades]
    if trade_ids:
        comments = db.scalars(select(TradeComment).where(TradeComment.trade_id.in_(trade_ids))).all()
        indexed = doc_store.indexed_source_ids(db, user_id, "trade_comment")
        by_id = {trade.id: trade for trade in trades}
        for comment in comments:
            if comment.id in indexed:
                continue
            ingest_trade_comment(db, comment, by_id.get(comment.trade_id))
            created += 1
    return created
