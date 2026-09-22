from __future__ import annotations

import logging
import uuid

from sqlalchemy import select

from app.core.config import settings
from app.models.playbook import Playbook
from app.services.ai.embeddings.openrouter import OpenRouterEmbeddingProvider
from app.services.ai.rag import documents as doc_builders
from app.services.ai.rag import ingest as ingest_service
from app.services.ai.rag import store as doc_store
from app.services.ai.tools.context import SourceRef, ToolContext

logger = logging.getLogger(__name__)

_embedder = OpenRouterEmbeddingProvider()
_BACKFILLED: set[uuid.UUID] = set()


def _ensure_index(ctx: ToolContext) -> None:
    if ctx.user_id in _BACKFILLED:
        return
    try:
        ingest_service.backfill_user_documents(ctx.db, ctx.user_id)
        ctx.db.commit()
        _BACKFILLED.add(ctx.user_id)
    except Exception:
        logger.exception("AI lazy backfill failed")
        ctx.db.rollback()
        ctx.warnings.append("Journal search index was unavailable for some entries.")


def _embed_query(query: str) -> list[float] | None:
    if not _embedder.is_configured():
        return None
    vectors = _embedder.embed([query])
    return vectors[0] if vectors else None


def _hits_payload(ctx: ToolContext, hits: list[doc_store.SearchHit], rag_warning: str | None = None) -> dict:
    items = []
    for hit in hits:
        meta = hit.metadata or {}
        title = str(meta.get("source_label") or hit.source_type)
        source = SourceRef(
            type=hit.source_type,
            id=str(hit.source_id),
            title=title,
            date=meta.get("date"),
        )
        ctx.add_source(source)
        items.append(
            {
                "source_type": hit.source_type,
                "source_id": str(hit.source_id),
                "title": title,
                "date": meta.get("date"),
                "excerpt": (hit.content or "")[:500],
            }
        )
    payload: dict = {"matches": items, "insufficient_data": len(items) == 0}
    if rag_warning:
        payload["warning"] = rag_warning
        ctx.warnings.append(rag_warning)
    return payload


def _search(ctx: ToolContext, query: str, source_types: tuple[str, ...]) -> dict:
    _ensure_index(ctx)
    warning = None
    embedding = None
    try:
        embedding = _embed_query(query)
    except Exception:
        logger.exception("Query embedding failed")
        warning = "Semantic journal search was unavailable; used keyword search instead."
    if embedding is None and _embedder.is_configured():
        warning = "Semantic journal search was unavailable; used keyword search instead."
    try:
        hits = doc_store.search_documents(
            ctx.db,
            user_id=ctx.user_id,
            query=query,
            source_types=source_types,
            query_embedding=embedding,
            top_k=settings.ai_max_context_documents,
        )
    except Exception:
        logger.exception("Document search failed")
        return {
            "matches": [],
            "insufficient_data": True,
            "warning": "Journal search was unavailable.",
        }
    return _hits_payload(ctx, hits, warning)


def search_user_journal(ctx: ToolContext, args: dict) -> dict:
    query = str(args.get("query") or args.get("q") or "").strip()
    if not query:
        return {"matches": [], "insufficient_data": True, "warning": "A search query is required."}
    return _search(ctx, query, doc_builders.JOURNAL_TYPES)


def search_user_trade_notes(ctx: ToolContext, args: dict) -> dict:
    query = str(args.get("query") or args.get("q") or "").strip()
    if not query:
        return {"matches": [], "insufficient_data": True, "warning": "A search query is required."}
    return _search(ctx, query, doc_builders.TRADE_NOTE_TYPES)


def get_playbook_context(ctx: ToolContext, args: dict) -> dict:
    query = str(args.get("query") or args.get("q") or args.get("name") or "").strip()
    playbooks = list(
        ctx.db.scalars(
            select(Playbook).where(Playbook.user_id == ctx.user_id, Playbook.is_archived.is_(False))
        ).all()
    )
    catalog = []
    for playbook in playbooks:
        catalog.append(
            {
                "id": str(playbook.id),
                "name": playbook.name,
                "description": (playbook.description or "")[:400],
                "tags": list(playbook.tags or []),
            }
        )
        ctx.add_source(SourceRef(type="playbook", id=str(playbook.id), title=playbook.name))
    search = _search(ctx, query or "playbook rules checklist", doc_builders.PLAYBOOK_TYPES) if playbooks else {
        "matches": [],
        "insufficient_data": True,
    }
    return {
        "playbooks": catalog[:20],
        "matches": search.get("matches") or [],
        "insufficient_data": not catalog,
        "warning": search.get("warning"),
    }
