"""Per-provider request windows already used by the connectors.

These numbers are the values the connectors send today. They are not a fresh
doc review. Change one only after checking the provider doc URL on the registry.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta


@dataclass(frozen=True)
class ProviderLimit:
    history_window_days: int | None
    page_size: int | None
    recv_window_ms: int | None
    note: str
    request_budget: int | None = 2000

    @property
    def history_window(self) -> timedelta | None:
        if self.history_window_days is None:
            return None
        return timedelta(days=self.history_window_days)

    def public(self) -> dict:
        return {
            "history_window_days": self.history_window_days,
            "page_size": self.page_size,
            "recv_window_ms": self.recv_window_ms,
            "request_budget": self.request_budget,
            "note": self.note,
        }


_FILE = ProviderLimit(
    None,
    None,
    None,
    "File import has no provider history window.",
    request_budget=None,
)

LIMITS: dict[str, ProviderLimit] = {
    "mt5": ProviderLimit(None, None, None, "The bridge returns its own history. TradeFix then keeps rows inside the selected date range."),
    "mt4": ProviderLimit(None, None, None, "The bridge returns its own history. TradeFix then keeps rows inside the selected date range."),
    "xm": ProviderLimit(None, None, None, "Same window as the MetaTrader bridge."),
    "exness": ProviderLimit(None, None, None, "Same window as the MetaTrader bridge. The Exness Public Trader API is not called."),
    "avatrade": ProviderLimit(None, None, None, "Same window as the MetaTrader bridge."),
    "ctrader": ProviderLimit(None, None, None, "Deal history is requested for the selected range over the Open API session."),
    "xtb": _FILE,
    "zerodha": _FILE,
    "binance": ProviderLimit(
        None,
        1000,
        5000,
        "myTrades is symbol-scoped. page_size 1000 and recvWindow 5000ms are the values this connector sends.",
    ),
    "bybit": ProviderLimit(7, 100, 5000, "Execution history is requested in 7-day chunks with page size 100."),
    "bitget": ProviderLimit(7, 100, None, "Fill history is requested in 7-day chunks with page size 100."),
    "okx": ProviderLimit(7, 100, None, "Fill history is requested in 7-day chunks with page size 100."),
    "delta": ProviderLimit(None, 50, None, "Fill pages use page_size 50."),
}


def limit_for(provider_id: str) -> ProviderLimit:
    found = LIMITS.get(provider_id)
    if found is None:
        return _FILE
    return found
