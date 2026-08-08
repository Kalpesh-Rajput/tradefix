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
    # Auto-routes to whichever free model is currently available on OpenRouter.
    openrouter_model: str = "openrouter/free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Comma-separated list is supported, e.g.
    # https://tradefix.vercel.app,https://tradefix-xxx-kalpesh-rajput.vercel.app
    frontend_origin: str = "http://localhost:3000"
    # Allow Vercel production + preview URLs without listing every deploy hash.
    frontend_origin_regex: str = r"https://.*\.vercel\.app"

    google_client_id: str = ""
    google_client_secret: str = ""

    enable_scheduler: bool = True

    # Local uploads (avatars, recap screenshots). Served at /uploads; swap for S3 later via storage service.
    upload_dir: str = "uploads"
    max_avatar_bytes: int = 2 * 1024 * 1024  # 2 MB
    max_screenshot_bytes: int = 5 * 1024 * 1024  # 5 MB
    max_recap_screenshots: int = 5

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
