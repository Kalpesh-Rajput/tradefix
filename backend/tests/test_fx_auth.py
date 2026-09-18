from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_fx_endpoints_require_auth():
    assert client.get("/api/fx/quote?base=USD&quote=INR").status_code == 401
    assert client.get("/api/fx/currencies").status_code == 401
