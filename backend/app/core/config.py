from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Force the psycopg (v3) SQLAlchemy dialect.

    Neon/Render often provide postgresql:// or postgres:// URLs. Those default
    to psycopg2, which is not in requirements.txt.
    """
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql+psycopg2://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql+psycopg2://")
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TradeFix"

    database_url: str = "postgresql+psycopg://tradefix_user:yourpassword@localhost:5432/tradefix"

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: object) -> object:
        if isinstance(value, str):
            return normalize_database_url(value.strip())
        return value

    jwt_secret: str = "change-this-to-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    openrouter_api_key: str = ""
    # Model id is env-only so production can swap without code changes.
    openrouter_model: str = "openrouter/free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_embedding_model: str = ""

    # groq | openrouter. Chat uses this provider; embeddings stay optional on OpenRouter.
    ai_provider: str = "groq"
    groq_api_key: str = ""
    # Groq retired llama-3.1-8b-instant on 2026-08-16. Use a live catalog id.
    groq_model: str = "qwen/qwen3.8-27b"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    ai_daily_limit: int = 50
    ai_hourly_limit: int = 20
    ai_max_context_documents: int = 8
    ai_max_trade_results: int = 100
    ai_max_tool_iterations: int = 3
    ai_embedding_dim: int = 1536
    ai_max_history_messages: int = 8

    # Comma-separated list is supported, e.g.
    # https://tradefix.vercel.app,https://tradefix-xxx-kalpesh-rajput.vercel.app
    frontend_origin: str = "http://localhost:3000"
    # Allow Vercel production + preview URLs without listing every deploy hash.
    frontend_origin_regex: str = r"https://.*\.(vercel\.app|ngrok-free\.app|ngrok\.app|ngrok\.io)"

    google_client_id: str = ""
    google_client_secret: str = ""

    enable_scheduler: bool = True

    # Local uploads (avatars, recap screenshots). Served at /uploads; swap for S3 later via storage service.
    upload_dir: str = "uploads"
    max_avatar_bytes: int = 2 * 1024 * 1024  # 2 MB
    max_screenshot_bytes: int = 5 * 1024 * 1024  # 5 MB
    max_recap_screenshots: int = 5

    # Optional. GIF/sticker search on the calendar share editor.
    # Create a key at https://developers.giphy.com — client search is proxied server-side.
    giphy_api_key: str = ""

    # Delayed daily FX table. No API key. Never treat these as live/real-time quotes.
    fx_provider_url: str = "https://open.er-api.com/v6/latest/USD"
    fx_cache_ttl_seconds: int = 900

    @property
    def cors_origins(self) -> list[str]:
        origins = [part.strip() for part in self.frontend_origin.split(",") if part.strip()]
        for local in (
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ):
            if local not in origins:
                origins.append(local)
        return origins

    @property
    def active_ai_provider(self) -> str:
        name = (self.ai_provider or "").strip().lower()
        if name in {"groq", "openrouter"}:
            return name
        return "groq" if self.groq_api_key else "openrouter"

    @property
    def ai_api_key(self) -> str:
        if self.active_ai_provider == "groq":
            return self.groq_api_key
        return self.openrouter_api_key

    @property
    def ai_model(self) -> str:
        if self.active_ai_provider == "groq":
            return self.groq_model
        return self.openrouter_model

    @property
    def ai_base_url(self) -> str:
        if self.active_ai_provider == "groq":
            return self.groq_base_url
        return self.openrouter_base_url

    @property
    def ai_key_name(self) -> str:
        return "GROQ_API_KEY" if self.active_ai_provider == "groq" else "OPENROUTER_API_KEY"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
