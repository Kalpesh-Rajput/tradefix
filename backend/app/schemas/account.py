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


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    base_currency: str = Field(default="USD", max_length=10)
    initial_balance: Decimal = Field(default=Decimal("10000"))
    pnl_display_mode: str = Field(default="net", max_length=16)
    default_fee_per_trade: Decimal = Field(default=Decimal("0"))
    is_default: bool = False

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
    trade_count: int = 0

    model_config = {"from_attributes": True}
