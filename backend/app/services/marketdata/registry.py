"""Instrument registry: YAML source of truth, validated at load and mirrored into the `instruments` table."""

from __future__ import annotations

import logging
import threading
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.models.market_data import Instrument

logger = logging.getLogger(__name__)

REGISTRY_PATH = Path(__file__).with_name("instruments.yaml")
_HEADER = (
    "# Instrument registry (backtesting/02 section 2). Adding an instrument = add an entry, then run backfill.\n"
    "# Every entry stays enabled: false until `python -m app.cli.marketdata verify-instrument <SYMBOL> --write`\n"
    "# fetches a real day and stamps verified_on (D-027).\n"
)
_write_lock = threading.Lock()


class InstrumentSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    symbol: str = Field(pattern=r"^[A-Z0-9_]{3,32}$")
    asset_class: Literal["forex", "metal", "index", "commodity", "crypto"]
    source: Literal["binance", "dukascopy"]
    provider_id: str = Field(min_length=1, max_length=64)
    market_type: Literal["spot", "usdm_futures"] = "spot"
    pip_size: float = Field(gt=0)
    contract_size: float = Field(gt=0)
    quote_currency: str = Field(pattern=r"^[A-Z]{3,4}$")
    price_decimals: int = Field(ge=0, le=10)
    preload_years: int = Field(ge=0, le=20)
    enabled: bool = False
    verified_on: date | None = None

    @field_validator("market_type")
    @classmethod
    def _futures_only_binance(cls, value: str, info) -> str:
        if value == "usdm_futures" and info.data.get("source") != "binance":
            raise ValueError("usdm_futures is only valid for the binance source")
        return value


class RegistryFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    instruments: list[InstrumentSpec]

    @field_validator("instruments")
    @classmethod
    def _unique(cls, items: list[InstrumentSpec]) -> list[InstrumentSpec]:
        seen: set[str] = set()
        for item in items:
            if item.symbol in seen:
                raise ValueError(f"duplicate instrument {item.symbol}")
            seen.add(item.symbol)
        return items


def parse_registry(text: str) -> list[InstrumentSpec]:
    """Validate registry YAML text and return the instrument specs."""
    return RegistryFile.model_validate(yaml.safe_load(text) or {}).instruments


@lru_cache(maxsize=1)
def _load(path: str) -> tuple[InstrumentSpec, ...]:
    return tuple(parse_registry(Path(path).read_text(encoding="utf-8")))


def all_instruments(path: Path = REGISTRY_PATH) -> tuple[InstrumentSpec, ...]:
    return _load(str(path))


def enabled_instruments(path: Path = REGISTRY_PATH) -> list[InstrumentSpec]:
    return [i for i in all_instruments(path) if i.enabled]


def get_instrument(symbol: str, path: Path = REGISTRY_PATH) -> InstrumentSpec | None:
    key = (symbol or "").strip().upper()
    return next((i for i in all_instruments(path) if i.symbol == key), None)


def reload_registry() -> None:
    _load.cache_clear()


def _write_specs(specs: list[InstrumentSpec], path: Path) -> None:
    rows = [s.model_dump(mode="json") for s in specs]
    body = "instruments:\n" + "".join(
        "- " + yaml.safe_dump(row, default_flow_style=True, sort_keys=False, width=1000) for row in rows
    )
    tmp = path.with_suffix(".yaml.tmp")
    tmp.write_text(_HEADER + body, encoding="utf-8")
    tmp.replace(path)
    reload_registry()


def mark_verified(symbol: str, on: date, path: Path = REGISTRY_PATH) -> InstrumentSpec:
    """Stamp verified_on and enable the instrument in the YAML file (verify-instrument --write)."""
    with _write_lock:
        specs = list(parse_registry(path.read_text(encoding="utf-8")))
        index = next((n for n, s in enumerate(specs) if s.symbol == symbol), None)
        if index is None:
            raise KeyError(symbol)
        specs[index] = specs[index].model_copy(update={"verified_on": on, "enabled": True})
        _write_specs(specs, path)
        return specs[index]


def mark_disabled(symbol: str, path: Path = REGISTRY_PATH) -> InstrumentSpec:
    """Switch an instrument off and clear its verification stamp (stored data failed a check)."""
    with _write_lock:
        specs = list(parse_registry(path.read_text(encoding="utf-8")))
        index = next((n for n, s in enumerate(specs) if s.symbol == symbol), None)
        if index is None:
            raise KeyError(symbol)
        specs[index] = specs[index].model_copy(update={"verified_on": None, "enabled": False})
        _write_specs(specs, path)
        return specs[index]


def add_instruments(new_specs: list[InstrumentSpec], path: Path = REGISTRY_PATH) -> list[str]:
    """Append instruments that are not in the YAML yet (always as written, existing entries are untouched)."""
    with _write_lock:
        specs = list(parse_registry(path.read_text(encoding="utf-8")))
        known = {s.symbol for s in specs}
        added = [s for s in new_specs if s.symbol not in known]
        if added:
            _write_specs([*specs, *added], path)
        return [s.symbol for s in added]


def mirror_to_db(db: Session, path: Path = REGISTRY_PATH) -> int:
    """Upsert every registry entry into `instruments`. Idempotent; returns the number of rows written."""
    count = 0
    for spec in all_instruments(path):
        row = db.get(Instrument, spec.symbol) or Instrument(symbol=spec.symbol)
        for field, value in spec.model_dump().items():
            setattr(row, field, value)
        db.add(row)
        count += 1
    db.commit()
    return count


def mirror_on_startup() -> None:
    """Lifespan hook: mirror the registry without ever blocking app start."""
    from app.core.db import SessionLocal

    try:
        with SessionLocal() as db:
            written = mirror_to_db(db)
        logger.info("instrument registry mirrored", extra={"instruments": written})
    except Exception:
        logger.exception("instrument registry mirror failed")
