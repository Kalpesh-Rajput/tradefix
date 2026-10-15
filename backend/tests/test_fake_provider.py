"""ENVIRONMENT=test must not construct a live provider."""

from app.core.config import settings
from app.services.marketdata.providers import get_provider
from app.services.marketdata.providers.base import ProviderError
from app.services.marketdata.registry import get_instrument


def test_test_environment_does_not_fetch(monkeypatch):
    monkeypatch.setattr(settings, "environment", "test")
    provider = get_provider("binance")
    try:
        list(provider.iter_chunks(get_instrument("BTCUSDT"), 0, 60_000))
    except ProviderError as exc:
        assert exc.code == "provider_disabled" and exc.retryable is False
    else:
        raise AssertionError("the fake provider should refuse")
