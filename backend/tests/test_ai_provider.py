from types import SimpleNamespace

from app.core.config import Settings
from app.services.ai.openrouter_client import _result_from_tool_failure


def test_groq_is_active_provider_by_default(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    settings = Settings()
    assert settings.active_ai_provider == "groq"
    assert settings.ai_api_key == "gsk_test"
    assert settings.ai_model == "qwen/qwen3.8-27b"
    assert settings.ai_base_url == "https://api.groq.com/openai/v1"
    assert settings.ai_key_name == "GROQ_API_KEY"


def test_tool_use_failed_is_recovered_as_content():
    exc = SimpleNamespace(
        body={
            "error": {
                "code": "tool_use_failed",
                "failed_generation": '{"name": "best_time_of_day", "arguments": {"metric": "best_time_of_day"}}',
            }
        }
    )
    result = _result_from_tool_failure(exc)  # type: ignore[arg-type]
    assert result is not None
    assert "best_time_of_day" in (result.content or "")


def test_openrouter_can_be_selected(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openrouter")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.setenv("OPENROUTER_MODEL", "qwen/qwen3.8-27b:free")
    settings = Settings()
    assert settings.active_ai_provider == "openrouter"
    assert settings.ai_api_key == "sk-or-test"
    assert settings.ai_model == "qwen/qwen3.8-27b:free"
    assert settings.ai_key_name == "OPENROUTER_API_KEY"
