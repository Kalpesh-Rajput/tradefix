from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def backend_path(value: str) -> Path:
    """Resolve a configured path; relative values are anchored at the backend folder, not the cwd."""
    path = Path(value)
    return path if path.is_absolute() else BACKEND_ROOT / path


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

    # AES-256-GCM keyring. Format: "keyId:base64,keyId:base64". Never commit real keys.
    broker_credentials_keys: str = ""
    broker_credentials_active_key: str = ""
    # Existing TradeFix-Connectors base URL, called by the worker only. Empty means MT sync is unavailable.
    tradefix_mt_bridge_url: str = ""
    tradefix_mt_bridge_token: str = ""
    broker_egress_ip: str = ""
    ctrader_client_id: str = ""
    ctrader_client_secret: str = ""
    ctrader_redirect_uri: str = ""
    broker_worker_in_process: bool = True
    sync_job_timeout_seconds: int = 3600
    sync_heartbeat_seconds: int = 15
    sync_default_interval_minutes: int = 15
    sync_reconcile_minutes: int = 10
    sync_overlap_minutes: int = 30

    # Market data and backtesting. Every limit here is documented in .env.example and backtesting/02.
    market_data_dir: str = "market_data"
    candle_max_bars_per_request: int = 5000
    candle_requests_per_minute: int = 120
    candle_cache_max_entries: int = 256
    inline_fetch_max_gap_minutes: int = 4320
    inline_fetch_timeout_s: float = 8.0
    inline_fetch_max_concurrent: int = 4
    candle_outlier_range_multiple: float = 20.0
    binance_rest_hosts: str = "https://api.binance.com,https://data-api.binance.vision"
    binance_futures_rest_host: str = "https://fapi.binance.com"
    binance_archive_host: str = "https://data.binance.vision"
    binance_requests_per_second: float = 5.0
    dukascopy_enabled: bool = True
    dukascopy_price_side: str = "bid"
    dukascopy_chunk_days: int = 7
    dukascopy_tool_dir: str = "tools/dukascopy"
    dukascopy_requests_per_second: float = 0.5
    dukascopy_timeout_s: int = 300
    market_worker_in_process: bool = False
    market_worker_poll_seconds: float = 2.0
    market_worker_lock_key: int = 740001
    scheduler_lock_key: int = 740002
    worker_heartbeat_stale_seconds: int = 60
    jobs_max_concurrent_binance: int = 2
    jobs_max_concurrent_dukascopy: int = 1
    jobs_max_concurrent_backtest: int = 2
    job_max_attempts: int = 5
    job_lock_seconds: int = 300
    job_backoff_base_seconds: float = 15.0
    job_backoff_max_seconds: float = 900.0
    replay_window_bars_before: int = 200
    replay_window_bars_after: int = 100
    replay_suggested_start_bars: int = 100
    replay_alignment_tolerance_pct: float = 0.05
    replay_alignment_tolerance_pips: float = 2.0
    time_offset_candidates: str = "UTC,Etc/GMT-2,Etc/GMT-3,NY_CLOSE,Europe/London"
    time_offset_min_sample: int = 5
    backtest_max_bars_per_run: int = 500000
    backtest_runs_per_day: int = 30
    backtest_max_concurrent_per_user: int = 1
    backtest_max_strategies: int = 50
    backtest_max_sessions: int = 50
    backtest_max_trades_per_run: int = 5000
    backtest_time_limit_s: int = 120
    backtest_cache_window_hours: int = 24
    backtest_equity_points: int = 1000
    strategy_max_conditions: int = 10
    strategy_max_indicators: int = 6
    indicator_period_min: int = 2
    indicator_period_max: int = 500
    topup_utc_hour: int = 0
    topup_utc_minute: int = 35
    crosscheck_tolerance_pct: float = 0.1

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
