"""API integration and database tests for `/api/news`, `/api/news/bookmarks`, and Alembic migration 0042."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from app.api.deps import get_current_user
from app.core.db import get_db
from app.main import app
from app.services.news import reset_news_state
from app.services.news.providers import parse_google_rss_xml, parse_marketaux_json
from app.services.news.types import ProviderFetchResult
from tests.bt_support import ENGINE, db, make_user, requires_db  # noqa: F401
from tests.test_news_service import SAMPLE_MARKETAUX_JSON, SAMPLE_RSS_XML

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def _clean_news_state():
    reset_news_state()
    yield
    reset_news_state()


def test_news_endpoints_require_authentication():
    anon = TestClient(app)
    assert anon.get("/api/news").status_code == 401
    assert anon.get("/api/news/bookmarks").status_code == 401
    assert anon.post("/api/news/bookmarks", json={}).status_code == 401
    assert anon.delete("/api/news/bookmarks/abc12345").status_code == 401


@requires_db
def test_news_feed_filtering_pagination_and_bookmarks_isolation(db, monkeypatch):  # noqa: F811
    user_a = make_user(db)
    user_b = make_user(db)
    holder = {"user": user_a}

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: holder["user"]

    rss_items = parse_google_rss_xml(SAMPLE_RSS_XML)
    mkt_items = parse_marketaux_json(SAMPLE_MARKETAUX_JSON)

    monkeypatch.setattr(
        "app.services.news.service.fetch_google_rss",
        lambda *a, **kw: ProviderFetchResult(
            provider="google_rss", enabled=True, healthy=True, status="ok", articles=rss_items
        ),
    )
    monkeypatch.setattr(
        "app.services.news.service.fetch_marketaux",
        lambda *a, **kw: ProviderFetchResult(
            provider="marketaux", enabled=True, healthy=True, status="ok", articles=mkt_items
        ),
    )
    monkeypatch.setattr(
        "app.services.news.service.fetch_gdelt_doc",
        lambda *a, **kw: ProviderFetchResult(
            provider="gdelt", enabled=False, healthy=False, status="disabled"
        ),
    )

    try:
        client = TestClient(app)

        # 1. Fetch All News feed
        resp = client.get("/api/news")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["meta"]["candidate_count"] == 3
        assert payload["meta"]["sentiment_available"] is True
        assert payload["featured"] is not None

        # 2. Filter by category=crypto
        crypto_resp = client.get("/api/news?category=crypto")
        assert crypto_resp.status_code == 200
        crypto_data = crypto_resp.json()
        assert crypto_data["meta"]["candidate_count"] == 1
        assert crypto_data["featured"]["category"] == "crypto"
        assert "BTC/USD" in crypto_data["featured"]["symbols"]

        # 3. Deterministic pagination (page_size=1)
        p1 = client.get("/api/news?page=1&page_size=1").json()
        p2 = client.get("/api/news?page=2&page_size=1").json()
        assert len(p1["articles"]) == 1
        assert len(p2["articles"]) == 1
        assert p1["articles"][0]["id"] != p2["articles"][0]["id"]
        assert p1["meta"]["has_more"] is True

        # 4. Bookmark creation (idempotent duplicate protection + HTML sanitization)
        target_article = payload["articles"][0]
        bm_body = {
            "article_id": target_article["id"],
            "title": f"<b>{target_article['title']}</b>",
            "summary": target_article["summary"],
            "url": target_article["url"],
            "source": target_article["source"],
            "published_at": target_article["published_at"],
            "category": target_article["category"],
            "symbols": target_article["symbols"],
            "symbols_source": target_article["symbols_source"],
            "sentiment": target_article["sentiment"],
            "provider": target_article["provider"],
        }
        save1 = client.post("/api/news/bookmarks", json=bm_body)
        assert save1.status_code == 201
        assert "<b>" not in save1.json()["title"]

        # Duplicate save is idempotent
        save2 = client.post("/api/news/bookmarks", json=bm_body)
        assert save2.status_code == 201

        list_a = client.get("/api/news/bookmarks").json()
        assert len(list_a) == 1
        assert list_a[0]["id"] == target_article["id"]

        # Feed marks the article as bookmarked for user A
        feed_a = client.get("/api/news").json()
        matched_a = [a for a in feed_a["articles"] if a["id"] == target_article["id"]][0]
        assert matched_a["is_bookmarked"] is True

        # 5. User B cannot see or delete User A's bookmarks
        holder["user"] = user_b
        assert client.get("/api/news/bookmarks").json() == []
        assert client.delete(f"/api/news/bookmarks/{target_article['id']}").status_code == 404

        # 6. Reject unsafe URL in bookmark creation
        bad_bm = {**bm_body, "article_id": "bad12345", "url": "javascript:alert(1)"}
        assert client.post("/api/news/bookmarks", json=bad_bm).status_code == 422

        # 7. User A can delete their own bookmark
        holder["user"] = user_a
        assert client.delete(f"/api/news/bookmarks/{target_article['id']}").status_code == 204
        assert client.get("/api/news/bookmarks").json() == []
    finally:
        app.dependency_overrides.clear()


@requires_db
def test_migration_0042_upgrade_downgrade_roundtrip():
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))

    command.upgrade(cfg, "head")
    assert "news_bookmarks" in set(inspect(ENGINE).get_table_names())

    try:
        command.downgrade(cfg, "0041")
        assert "news_bookmarks" not in set(inspect(ENGINE).get_table_names())
    finally:
        command.upgrade(cfg, "head")

    assert "news_bookmarks" in set(inspect(ENGINE).get_table_names())
