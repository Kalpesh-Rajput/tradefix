from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TradeFix"

    database_url: str = "postgresql+psycopg://tradefix_user:yourpassword@localhost:5432/tradefix"

    jwt_secret: str = "change-this-to-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    openrouter_api_key: str = ""
    # Auto-routes to whichever free model is currently available on OpenRouter.
    openrouter_model: str = "openrouter/free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    frontend_origin: str = "http://localhost:3000"

    enable_scheduler: bool = True

    # Local uploads (avatars). Served at /uploads; swap for S3 later via storage service.
    upload_dir: str = "uploads"
    max_avatar_bytes: int = 2 * 1024 * 1024  # 2 MB


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
