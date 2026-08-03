import re
import uuid
from zoneinfo import ZoneInfo, available_timezones

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

_URL_RE = re.compile(r"^https?://[^\s]+$", re.IGNORECASE)
_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]*$")
_LANGUAGE_RE = re.compile(r"^[a-z]{2,3}(-[A-Za-z]{2,8})?$")
_DATE_FORMATS = {"MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"}
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


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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

    model_config = {"from_attributes": True}


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
        return cleaned

    @field_validator("date_format")
    @classmethod
    def validate_date_format(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if cleaned not in _DATE_FORMATS:
            raise ValueError("Invalid date format")
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
