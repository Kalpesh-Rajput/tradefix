import uuid
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

_CURRENCIES = {
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "INR",
    "AUD",
    "CAD",
    "CHF",
    "CNY",
    "HKD",
    "SGD",
    "NZD",
    "KRW",
    "BRL",
    "MXN",
    "ZAR",
    "SEK",
    "NOK",
    "DKK",
    "PLN",
    "TRY",
    "AED",
}
_PNL_MODES = {"net", "gross"}
_ACCOUNT_SOURCES = {"dummy", "broker"}


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    base_currency: str = Field(default="USD", max_length=10)
    initial_balance: Decimal = Field(default=Decimal("10000"))
    pnl_display_mode: str = Field(default="net", max_length=16)
    default_fee_per_trade: Decimal = Field(default=Decimal("0"))
    is_default: bool = False
    source: str = Field(default="dummy", max_length=16)
    broker_id: str | None = Field(default=None, max_length=64)
    broker_name: str | None = Field(default=None, max_length=255)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Account name is required")
        return cleaned

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("base_currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        cleaned = value.strip().upper()
        if cleaned not in _CURRENCIES:
            raise ValueError("Unsupported currency")
        return cleaned

    @field_validator("pnl_display_mode")
    @classmethod
    def validate_pnl_mode(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in _PNL_MODES:
            raise ValueError("Invalid P&L display mode")
        return cleaned

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in _ACCOUNT_SOURCES:
            raise ValueError("Invalid account source")
        return cleaned

    @field_validator("broker_id", "broker_name")
    @classmethod
    def clean_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("initial_balance", "default_fee_per_trade")
    @classmethod
    def validate_money(cls, value: Decimal) -> Decimal:
        return Decimal(str(value))


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    base_currency: str | None = Field(default=None, max_length=10)
    initial_balance: Decimal | None = None
    pnl_display_mode: str | None = Field(default=None, max_length=16)
    default_fee_per_trade: Decimal | None = None
    is_default: bool | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Account name is required")
        return cleaned

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("base_currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().upper()
        if cleaned not in _CURRENCIES:
            raise ValueError("Unsupported currency")
        return cleaned

    @field_validator("pnl_display_mode")
    @classmethod
    def validate_pnl_mode(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if cleaned not in _PNL_MODES:
            raise ValueError("Invalid P&L display mode")
        return cleaned


class AccountResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    base_currency: str
    initial_balance: Decimal
    pnl_display_mode: str
    default_fee_per_trade: Decimal
    is_default: bool
    source: str = "dummy"
    broker_id: str | None = None
    broker_name: str | None = None
    trade_count: int = 0

    model_config = {"from_attributes": True}
