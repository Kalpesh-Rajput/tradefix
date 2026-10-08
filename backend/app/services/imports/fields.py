"""Canonical trade columns and the header labels that map onto them."""

from __future__ import annotations

# Earlier aliases win when several columns could fill the same field.
FIELD_ORDER: tuple[str, ...] = (
    "symbol",
    "side",
    "quantity",
    "price",
    "exit_price",
    "executed_at",
    "closed_at",
    "commission",
    "swap",
    "external_id",
    "notes",
    "pnl",
)

ALIASES: dict[str, tuple[str, ...]] = {
    "symbol": ("symbol", "ticker", "instrument", "product_symbol", "item", "scrip", "stock"),
    "side": ("side", "direction", "buy_sell", "action", "transaction_type", "trade_type", "type"),
    "quantity": ("quantity", "qty", "volume", "size", "lots", "shares", "filled_qty"),
    "price": ("entry_price", "open_price", "price_open", "fill_price", "avg_price", "buy_price", "price", "entry"),
    "exit_price": ("exit_price", "close_price", "price_close", "sell_price", "exit"),
    "executed_at": (
        "executed_at",
        "entry_date_time",
        "open_time",
        "entry_time",
        "opened_at",
        "trade_date",
        "entry_date",
        "date_open",
        "date",
        "time",
    ),
    "closed_at": ("closed_at", "exit_date_time", "close_time", "exit_time", "date_close", "exit_date"),
    "commission": ("commission", "fees", "fee", "brokerage"),
    "swap": ("swap",),
    "external_id": ("external_id", "external_trade_id", "ticket", "order_id", "deal_id", "position_id", "deal"),
    "notes": ("notes", "comment", "comments"),
    "pnl": ("pnl", "net_pnl", "profit", "p_and_l"),
}

REQUIRED_FIELDS: tuple[str, ...] = ("symbol", "side", "quantity", "price", "executed_at")

FIELD_LABELS: dict[str, str] = {
    "symbol": "Symbol",
    "side": "Side",
    "quantity": "Quantity",
    "price": "Entry price",
    "exit_price": "Exit price",
    "executed_at": "Open time",
    "closed_at": "Close time",
    "commission": "Commission",
    "swap": "Swap",
    "external_id": "Ticket",
    "notes": "Notes",
    "pnl": "P&L",
}
