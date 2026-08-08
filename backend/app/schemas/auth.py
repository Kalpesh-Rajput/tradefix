import re
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo, available_timezones

from pydantic import BaseModel, EmailStr, Field, ValidationInfo, field_validator, model_validator

_URL_RE = re.compile(r"^https?://[^\s]+$", re.IGNORECASE)
_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]*$")
_LANGUAGE_RE = re.compile(r"^[a-z]{2,3}(-[A-Za-z]{2,8})?$")
_DATE_FORMATS = {"MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"}
_THEMES = {"dark", "light", "system"}
_ACCENT_COLORS = {"teal", "blue", "purple", "orange", "red", "pink", "emerald", "periwinkle"}
_SUPPORTED_LANGUAGES = {
    "en",
    "es",
    "fr",
    "de",
    "pt",
    "hi",
    "zh",
    "ja",
    "ko",
    "ar",
    "it",
    "nl",
    "ru",
    "tr",
    "pl",
}
_TIMEZONES = available_timezones()


def _optional_http_url(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if not _URL_RE.match(cleaned):
        raise ValueError("Must be a valid http(s) URL")
    return cleaned


_EXPERIENCE = {"newbie", "climbing", "ninja", "monk"}
_CAPITAL = {"personal", "prop", "not_started"}
_MARKETS = {"stocks", "options", "forex", "crypto", "futures", "cfd", "other"}
_GOALS = {"journal", "analyze", "backtest", "learn"}
_REFERRALS = {
    "google",
    "ai",
    "x",
    "instagram",
    "tiktok",
    "youtube",
    "reddit",
    "community",
    "friend",
    "other",
}
_REFERRAL_DETAILS: dict[str, set[str]] = {
    "google": {"organic", "ads", "unknown"},
    "ai": {"chatgpt", "grok", "gemini", "claude", "perplexity"},
    "instagram": {"tradefix", "affiliate"},
    "x": {"tradefix", "affiliate"},
    "tiktok": {"tradefix", "affiliate"},
    "youtube": {"tradefix", "affiliate"},
    "community": {"discord", "affiliate_community"},
}


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    username: str | None = None
    bio: str | None = None
    location: str | None = None
    website_url: str | None = None
    twitter_url: str | None = None
    linkedin_url: str | None = None
    avatar_url: str | None = None
    public_profile: bool = False
    show_financial_metrics: bool = True
    show_latest_trades: bool = True
    show_pnl_chart: bool = True
    timezone: str = "UTC"
    language: str = "en"
    date_format: str = "MM/DD/YYYY"
    save_filters: bool = False
    journal_template: str | None = None
    default_symbol: str | None = None
    default_quantity: float | None = None
    default_fee: float | None = None
    default_forex_leverage: float | None = None
    default_strategies: list[str] = Field(default_factory=list)
    custom_strategies: list[str] = Field(default_factory=list)
    strategy_order: list[str] = Field(default_factory=list)
    custom_mistakes: list[str] = Field(default_factory=list)
    mistake_order: list[str] = Field(default_factory=list)
    weekly_goal: float | None = None
    monthly_goal: float | None = None
    yearly_goal: float | None = None
    target_trades: int | None = None
    theme: str = "dark"
    accent_color: str = "teal"
    plan: str = "free"
    role: str = "trader"
    custom_emotion_tags: list[str] = Field(default_factory=list)
    emotion_tag_order: list[str] = Field(default_factory=list)
    onboarding_step: int = 0
    trading_experience: str | None = None
    capital_sources: list[str] = Field(default_factory=list)
    primary_broker: str | None = None
    markets_traded: list[str] = Field(default_factory=list)
    onboarding_goals: list[str] = Field(default_factory=list)
    referral_source: str | None = None
    referral_detail: str | None = None
    onboarding_completed_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator(
        "default_strategies",
        "custom_strategies",
        "strategy_order",
        "custom_mistakes",
        "mistake_order",
        "custom_emotion_tags",
        "emotion_tag_order",
        "capital_sources",
        "markets_traded",
        "onboarding_goals",
        mode="before",
    )
    @classmethod
    def coerce_list_fields(cls, value: object) -> object:
        return [] if value is None else value


def _normalize_choice_list(
    value: list[str] | None,
    *,
    allowed: set[str],
    field_name: str,
    max_items: int = 20,
) -> list[str]:
    if value is None:
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in value:
        if not isinstance(raw, str):
            raise ValueError(f"{field_name} must be a list of strings")
        item = raw.strip().lower()
        if not item:
            continue
        if item not in allowed:
            raise ValueError(f"Invalid {field_name} value: {raw}")
        if item in seen:
            continue
        seen.add(item)
        cleaned.append(item)
        if len(cleaned) > max_items:
            raise ValueError(f"{field_name} may contain at most {max_items} items")
    return cleaned


class OnboardingUpdateRequest(BaseModel):
    onboarding_step: int | None = Field(default=None, ge=0, le=6)
    trading_experience: str | None = Field(default=None, max_length=32)
    capital_sources: list[str] | None = None
    primary_broker: str | None = Field(default=None, max_length=128)
    markets_traded: list[str] | None = None
    onboarding_goals: list[str] | None = None
    referral_source: str | None = Field(default=None, max_length=64)
    referral_detail: str | None = Field(default=None, max_length=255)

    @field_validator("trading_experience")
    @classmethod
    def validate_experience(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if cleaned not in _EXPERIENCE:
            raise ValueError("Invalid trading experience")
        return cleaned

    @field_validator("capital_sources")
    @classmethod
    def validate_capital(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return _normalize_choice_list(value, allowed=_CAPITAL, field_name="capital_sources")

    @field_validator("markets_traded")
    @classmethod
    def validate_markets(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return _normalize_choice_list(value, allowed=_MARKETS, field_name="markets_traded")

    @field_validator("onboarding_goals")
    @classmethod
    def validate_goals(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return _normalize_choice_list(value, allowed=_GOALS, field_name="onboarding_goals")

    @field_validator("referral_source")
    @classmethod
    def validate_referral(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if cleaned not in _REFERRALS:
            raise ValueError("Invalid referral source")
        return cleaned

    @field_validator("primary_broker")
    @classmethod
    def validate_broker(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None

    @field_validator("referral_detail")
    @classmethod
    def validate_referral_detail(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None


def _normalize_label_list(value: list[str] | None, *, field_name: str, max_items: int = 100) -> list[str]:
    if value is None:
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in value:
        if not isinstance(raw, str):
            raise ValueError(f"{field_name} must be a list of strings")
        label = " ".join(raw.strip().split())
        if not label:
            continue
        if len(label) > 80:
            raise ValueError(f"{field_name} entries must be at most 80 characters")
        key = label.casefold()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(label)
        if len(cleaned) > max_items:
            raise ValueError(f"{field_name} may contain at most {max_items} items")
    return cleaned


class UserUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    username: str | None = Field(default=None, max_length=64)
    bio: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=255)
    website_url: str | None = Field(default=None, max_length=512)
    twitter_url: str | None = Field(default=None, max_length=512)
    linkedin_url: str | None = Field(default=None, max_length=512)
    public_profile: bool | None = None
    show_financial_metrics: bool | None = None
    show_latest_trades: bool | None = None
    show_pnl_chart: bool | None = None
    timezone: str | None = Field(default=None, max_length=64)
    language: str | None = Field(default=None, max_length=16)
    date_format: str | None = Field(default=None, max_length=32)
    save_filters: bool | None = None
    journal_template: str | None = Field(default=None, max_length=10000)
    default_symbol: str | None = Field(default=None, max_length=32)
    default_quantity: float | None = Field(default=None, ge=0)
    default_fee: float | None = Field(default=None, ge=0)
    default_forex_leverage: float | None = Field(default=None, ge=0)
    default_strategies: list[str] | None = None
    custom_strategies: list[str] | None = None
    strategy_order: list[str] | None = None
    custom_mistakes: list[str] | None = None
    mistake_order: list[str] | None = None
    custom_emotion_tags: list[str] | None = None
    emotion_tag_order: list[str] | None = None
    weekly_goal: float | None = Field(default=None, ge=0)
    monthly_goal: float | None = Field(default=None, ge=0)
    yearly_goal: float | None = Field(default=None, ge=0)
    target_trades: int | None = Field(default=None, ge=0)
    theme: str | None = Field(default=None, max_length=16)
    accent_color: str | None = Field(default=None, max_length=32)
    plan: str | None = Field(default=None, max_length=16)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lstrip("@")
        if not cleaned:
            return None
        if not _USERNAME_RE.match(cleaned):
            raise ValueError("Username may only contain letters, numbers, _ . -")
        return cleaned

    @field_validator("website_url", "twitter_url", "linkedin_url")
    @classmethod
    def validate_urls(cls, value: str | None) -> str | None:
        return _optional_http_url(value)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if cleaned not in _TIMEZONES:
            # Accept common aliases that ZoneInfo can resolve
            try:
                ZoneInfo(cleaned)
            except Exception as exc:
                raise ValueError("Invalid timezone") from exc
        return cleaned

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not _LANGUAGE_RE.match(cleaned):
            raise ValueError("Invalid language code")
        base = cleaned.split("-", 1)[0].lower()
        if base not in _SUPPORTED_LANGUAGES and cleaned not in _SUPPORTED_LANGUAGES:
            raise ValueError("Unsupported language")
        return base if base in _SUPPORTED_LANGUAGES else cleaned

    @field_validator("date_format")
    @classmethod
    def validate_date_format(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if cleaned not in _DATE_FORMATS:
            raise ValueError("Invalid date format")
        return cleaned

    @field_validator("default_symbol")
    @classmethod
    def validate_default_symbol(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().upper()
        return cleaned or None

    @field_validator(
        "default_strategies",
        "custom_strategies",
        "strategy_order",
        "custom_mistakes",
        "mistake_order",
        "custom_emotion_tags",
        "emotion_tag_order",
    )
    @classmethod
    def validate_label_lists(cls, value: list[str] | None, info: ValidationInfo) -> list[str] | None:
        if value is None:
            return None
        return _normalize_label_list(value, field_name=str(info.field_name))

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if cleaned not in _THEMES:
            raise ValueError("Invalid theme")
        return cleaned

    @field_validator("plan")
    @classmethod
    def validate_plan(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if cleaned not in ("free", "pro"):
            raise ValueError("Invalid plan")
        return cleaned

    @field_validator("accent_color")
    @classmethod
    def validate_accent_color(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if cleaned not in _ACCENT_COLORS:
            raise ValueError("Invalid accent color")
        return cleaned


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)
    confirm_password: str = Field(min_length=6, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self
