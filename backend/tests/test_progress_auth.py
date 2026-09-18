from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_progress_tracker_requires_auth():
    assert client.get("/api/progress-tracker/settings").status_code == 401
    assert client.get("/api/progress-tracker/summary?date_from=2026-01-01&date_to=2026-01-31").status_code == 401
    assert client.post("/api/progress-tracker/start-day", json={}).status_code == 401
    assert client.post("/api/progress-tracker/reset").status_code == 401
