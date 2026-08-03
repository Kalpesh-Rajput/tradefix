import io

import pandas as pd
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.trade import AssetType, Trade, TradeSide, TradeStatus
from app.models.user import User

# Generic column aliases so a variety of broker CSV exports "just work".
COLUMN_ALIASES = {
    "symbol": ["symbol", "ticker", "instrument"],
    "side": ["side", "direction", "action", "buy/sell"],
    "quantity": ["quantity", "qty", "shares", "size"],
    "entry_price": ["entry_price", "entry", "open_price", "price_open", "buy_price"],
    "exit_price": ["exit_price", "exit", "close_price", "price_close", "sell_price"],
    "opened_at": ["opened_at", "open_time", "entry_time", "date_open", "trade_date", "date"],
    "closed_at": ["closed_at", "close_time", "exit_time", "date_close"],
    "fees": ["fees", "commission", "commissions"],
    "setup_tag": ["setup_tag", "setup", "strategy"],
    "notes": ["notes", "comment", "comments"],
}


def _find_column(columns: list[str], aliases: list[str]) -> str | None:
    lower_map = {c.lower().strip(): c for c in columns}
    for alias in aliases:
        if alias in lower_map:
            return lower_map[alias]
    return None


def _parse_side(value) -> TradeSide:
    if value is None:
        return TradeSide.long
    text = str(value).strip().lower()
    if text in ("short", "sell", "s"):
        return TradeSide.short
    return TradeSide.long


def _fingerprint(row: dict) -> str:
    return f"{row.get('symbol')}|{row.get('opened_at')}|{row.get('entry_price')}|{row.get('quantity')}"


def import_trades_from_csv(
    db: Session,
    user: User,
    account: Account,
    file_bytes: bytes,
) -> tuple[int, int, list[str]]:
    errors: list[str] = []
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as exc:  # noqa: BLE001
        return 0, 0, [f"Could not parse CSV: {exc}"]

    columns = list(df.columns)
    col_map = {key: _find_column(columns, aliases) for key, aliases in COLUMN_ALIASES.items()}

    if not col_map["symbol"] or not col_map["opened_at"] or not col_map["entry_price"] or not col_map["quantity"]:
        return 0, 0, [
            "CSV is missing required columns. Need at least: symbol, quantity, entry price, and opened date."
        ]

    existing_fingerprints = {
        f"{t.symbol}|{t.opened_at}|{float(t.entry_price)}|{float(t.quantity)}"
        for t in account.trades
    }

    imported = 0
    skipped_duplicates = 0

    for idx, raw_row in df.iterrows():
        try:
            symbol = str(raw_row[col_map["symbol"]]).strip().upper()
            quantity = float(raw_row[col_map["quantity"]])
            entry_price = float(raw_row[col_map["entry_price"]])
            opened_at = pd.to_datetime(raw_row[col_map["opened_at"]]).to_pydatetime()

            exit_price = None
            if col_map["exit_price"] and not pd.isna(raw_row.get(col_map["exit_price"])):
                exit_price = float(raw_row[col_map["exit_price"]])

            closed_at = None
            if col_map["closed_at"] and not pd.isna(raw_row.get(col_map["closed_at"])):
                closed_at = pd.to_datetime(raw_row[col_map["closed_at"]]).to_pydatetime()

            fees = 0.0
            if col_map["fees"] and not pd.isna(raw_row.get(col_map["fees"])):
                fees = float(raw_row[col_map["fees"]])

            side = _parse_side(raw_row.get(col_map["side"])) if col_map["side"] else TradeSide.long
            setup_tag = None
            if col_map["setup_tag"] and not pd.isna(raw_row.get(col_map["setup_tag"])):
                setup_tag = str(raw_row[col_map["setup_tag"]]).strip()

            notes = None
            if col_map["notes"] and not pd.isna(raw_row.get(col_map["notes"])):
                notes = str(raw_row[col_map["notes"]]).strip()

            fp = f"{symbol}|{opened_at}|{entry_price}|{quantity}"
            if fp in existing_fingerprints:
                skipped_duplicates += 1
                continue
            existing_fingerprints.add(fp)

            status = TradeStatus.closed if exit_price is not None else TradeStatus.open
            direction = 1 if side == TradeSide.long else -1
            pnl = None
            if exit_price is not None:
                pnl = round((exit_price - entry_price) * quantity * direction - fees, 2)

            trade = Trade(
                user_id=user.id,
                account_id=account.id,
                symbol=symbol,
                asset_type=AssetType.stock,
                side=side,
                quantity=quantity,
                entry_price=entry_price,
                exit_price=exit_price,
                opened_at=opened_at,
                closed_at=closed_at,
                fees=fees,
                setup_tag=setup_tag,
                notes=notes,
                status=status,
                pnl=pnl,
            )
            db.add(trade)
            imported += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Row {idx + 2}: {exc}")

    db.commit()
    return imported, skipped_duplicates, errors
