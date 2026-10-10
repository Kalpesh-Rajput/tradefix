import io
from decimal import Decimal
from types import SimpleNamespace

import pytest
from openpyxl import Workbook

from app.services.imports.confirm import apply_journal, executions_for_row
from app.services.imports.duplicates import mark_duplicates
from app.services.imports.mapper import map_columns, unmapped_required
from app.services.imports.parser import ImportFileError, parse_file
from app.services.imports.pipeline import build_preview, reprocess_rows
from app.services.imports.parse import parse_upload


def test_csv_skips_preamble_and_flags_bad_and_duplicate_rows():
    payload = """Broker export
Generated today

Symbol,Side,Quantity,Price,Open Time
EURUSD,buy,0.10,1.1000,2024-01-02 10:00:00
,sell,1,1.25,2024-01-03 11:30:00
EURUSD,buy,0.10,1.1000,2024-01-02 10:00:00
""".encode()
    preview = build_preview("trades.csv", payload)
    assert preview.detected_format == "csv"
    assert preview.mapping["symbol"] == "Symbol"
    assert preview.mapping["executed_at"] == "Open Time"
    assert [row["status"] for row in preview.rows] == ["valid", "attention", "duplicate"]
    assert preview.rows[0]["normalized"]["side"] == "buy"
    assert preview.rows[0]["normalized"]["executed_at"].startswith("2024-01-02T10:00:00")
    assert "symbol is missing" in preview.rows[1]["errors"]
    assert "row" in preview.rows[2]["errors"][0].lower()


def test_trade_fix_headers_map_without_a_manual_map():
    payload = "Ticker,Side,Qty,Entry Price,Exit Price,Entry Date/Time,Commission\nAAPL,long,\"1,000\",190.5,191,2024-06-01 14:30:00,1.25\n".encode()
    preview = build_preview("journal.csv", payload)
    row = preview.rows[0]
    assert row["status"] == "valid"
    assert row["normalized"]["symbol"] == "AAPL"
    assert row["normalized"]["side"] == "buy"
    assert row["normalized"]["quantity"] == "1000"
    assert row["normalized"]["price"] == "190.5"
    assert row["normalized"]["exit_price"] == "191"
    assert row["normalized"]["commission"] == "1.25"


def test_xlsx_and_xml_use_the_same_mapper():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Trades"
    sheet.append(["Symbol", "Side", "Quantity", "Price", "Open Time"])
    sheet.append(["GBPUSD", "sell", 2, 1.25, "2024-02-01 09:15:00"])
    buffer = io.BytesIO()
    workbook.save(buffer)
    preview = build_preview("trades.xlsx", buffer.getvalue())
    assert preview.detected_format == "xlsx"
    assert preview.rows[0]["normalized"]["symbol"] == "GBPUSD"
    assert preview.rows[0]["status"] == "valid"

    xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<tradefix><trades><trade>
  <symbol>BTCUSDT</symbol>
  <side>buy</side>
  <quantity>0.5</quantity>
  <entry_price>42000</entry_price>
  <entry_date_time>2024-03-01T12:00:00+00:00</entry_date_time>
  <external_id>deal-9</external_id>
</trade></trades></tradefix>"""
    xml_preview = build_preview("trades.xml", xml)
    assert xml_preview.detected_format == "tradefix-xml"
    assert xml_preview.rows[0]["normalized"]["external_id"] == "deal-9"
    assert xml_preview.rows[0]["status"] == "valid"


def test_custom_mapping_reparses_unknown_columns():
    payload = b"Foo,Side,Qty,Entry Price,Open Time\nEURUSD,buy,1,1.1,2024-01-02 10:00:00\n"
    parsed = parse_file("trades.csv", payload)
    assert "symbol" in unmapped_required(map_columns(parsed.headers))
    mapping, rows = reprocess_rows(
        parsed,
        override={"symbol": "Foo", "side": "Side", "quantity": "Qty", "price": "Entry Price", "executed_at": "Open Time"},
        existing=set(),
    )
    assert mapping["symbol"] == "Foo"
    assert rows[0]["status"] == "valid"
    assert rows[0]["normalized"]["symbol"] == "EURUSD"


def test_existing_journal_row_is_a_duplicate():
    payload = b"Symbol,Side,Quantity,Price,Open Time,Ticket\nEURUSD,buy,1,1.1,2024-01-02 10:00:00,1001\n"
    preview = build_preview("trades.csv", payload)
    mark_duplicates(preview.rows, {"ext:1001"})
    assert preview.rows[0]["status"] == "duplicate"
    assert preview.rows[0]["errors"] == ["Already in this account"]


def test_xml_with_a_doctype_is_rejected():
    payload = b"""<?xml version="1.0"?><!DOCTYPE tradefix [<!ENTITY x "y">]><tradefix></tradefix>"""
    with pytest.raises(ImportFileError):
        parse_upload("trades.xml", payload)


def test_mt_html_statement_still_keeps_the_ticket():
    html = """
    <html><body>
    <b>Closed Transactions</b>
    <table><tr><td>Ticket</td></tr>
    <tr><td>1001</td><td>2024.01.02 10:00:00</td><td>buy</td><td>0.10</td><td>EURUSD</td>
    <td>1.1000</td><td>0</td><td>0</td><td>2024.01.02 12:00:00</td><td>1.1050</td><td>-1.00</td><td>0</td><td>-0.20</td><td>5</td></tr>
    </table></body></html>
    """
    kind, rows = parse_upload("statement.htm", html.encode())
    assert kind == "mt5-html"
    assert rows[0]["normalized"]["external_id"] == "1001"
    assert rows[0]["status"] == "valid"


def test_sell_with_only_an_exit_price_is_ready():
    payload = """Symbol,Type,Quantity,Buy Price,Exit Price,Entry Date/Time,Exit Date/Time
GBPUSD,buy,1,100,,2026-10-08 08:07:00,
GBPUSD,sell,1,,1.27,,2026-10-08 09:15:00
""".encode()
    preview = build_preview("TradeFix Test.csv", payload)
    buy, sell = preview.rows
    assert buy["status"] == "valid"
    assert buy["normalized"]["price"] == "100"
    assert sell["status"] == "valid"
    assert sell["normalized"]["side"] == "sell"
    assert sell["normalized"]["price"] is None
    assert sell["normalized"]["exit_price"] == "1.27"
    assert sell["normalized"]["closed_at"].startswith("2026-10-08T09:15:00")
    assert "entry price is missing" not in sell["errors"]


def test_sell_without_any_price_asks_for_the_exit():
    payload = b"Symbol,Type,Quantity,Buy Price,Exit Price,Entry Date/Time,Exit Date/Time\nGBPUSD,sell,1,,,,,\n"
    preview = build_preview("trades.csv", payload)
    errors = preview.rows[0]["errors"]
    assert preview.rows[0]["status"] == "attention"
    assert "exit price is missing" in errors
    assert "close time is missing" in errors
    assert "entry price is missing" not in errors


def test_exit_columns_satisfy_the_required_mapping():
    mapping = {
        "symbol": "Symbol",
        "side": "Type",
        "quantity": "Quantity",
        "exit_price": "Exit Price",
        "closed_at": "Exit Date/Time",
    }
    assert unmapped_required(mapping) == []
    assert unmapped_required({"symbol": "Symbol", "side": "Type", "quantity": "Quantity"}) == ["price", "executed_at"]


def test_duplicate_exit_rows_in_one_file():
    payload = """Symbol,Type,Quantity,Exit Price,Exit Date/Time
GBPUSD,sell,1,1.27,2026-10-08 09:15:00
GBPUSD,sell,1,1.27,2026-10-08 09:15:00
""".encode()
    preview = build_preview("exits.csv", payload)
    assert [row["status"] for row in preview.rows] == ["attention", "duplicate"]
    assert "No matching buy in this file" in preview.rows[0]["errors"]


def test_round_trip_row_still_opens_and_closes():
    row = SimpleNamespace(
        row_number=1,
        raw={},
        normalized={
            "symbol": "AAPL",
            "side": "buy",
            "quantity": "1",
            "price": "190.5",
            "exit_price": "191",
            "executed_at": "2024-06-01T14:30:00+00:00",
            "closed_at": None,
            "commission": "1.25",
            "swap": None,
            "external_id": None,
        },
    )
    fills, error = executions_for_row(row)
    assert error is None
    assert [fill.side for fill in fills] == ["buy", "sell"]
    assert fills[0].price == Decimal("190.5")
    assert fills[1].price == Decimal("191")
    assert fills[0].external_position_id == fills[1].external_position_id


def test_notes_and_emotions_are_mapped_with_the_required_columns():
    payload = """Symbol,Type,Quantity,Buy Price,Entry Date/Time,Fees,Notes,Emotions
GBPJPY,buy,10,100,2026-10-09 08:07:00,1.25,Waited for the level,"FOMO, Anxious"
""".encode()
    preview = build_preview("trades.csv", payload)
    assert preview.mapping["symbol"] == "Symbol"
    assert preview.mapping["notes"] == "Notes"
    assert preview.mapping["emotions"] == "Emotions"
    assert preview.mapping["commission"] == "Fees"
    row = preview.rows[0]
    assert row["status"] == "valid"
    assert row["normalized"]["notes"] == "Waited for the level"
    assert row["normalized"]["emotions"] == "FOMO, Anxious"


def test_unknown_headers_map_from_the_cell_values():
    payload = """Pair,Action,Lots,Open,Exit,Opened,Closed,Journal,State,Play,Account
GBPJPY,buy,10,100,105,2026-10-09 08:07:00,2026-10-09 09:15:00,Waited for the London open,FOMO,Breakout,AvaTrade
EURUSD,sell,1,1.1000,1.1050,2026-10-09 10:00:00,2026-10-09 11:00:00,Took the second test,Anxious,Breakout,AvaTrade
""".encode()
    preview = build_preview("trades.csv", payload)
    assert preview.mapping["symbol"] == "Pair"
    assert preview.mapping["side"] == "Action"
    assert preview.mapping["quantity"] == "Lots"
    assert preview.mapping["price"] == "Open"
    assert preview.mapping["exit_price"] == "Exit"
    assert preview.mapping["executed_at"] == "Opened"
    assert preview.mapping["closed_at"] == "Closed"
    assert preview.mapping["notes"] == "Journal"
    assert preview.mapping["emotions"] == "State"
    assert preview.mapping["strategy"] == "Play"
    assert "Account" not in preview.mapping.values()
    row = preview.rows[0]
    assert row["status"] == "valid"
    assert row["normalized"]["notes"] == "Waited for the London open"
    assert row["normalized"]["emotions"] == "FOMO"
    assert row["normalized"]["strategy"] == "Breakout"
    assert row["normalized"]["price"] == "100"


def test_a_broker_name_column_stays_unmapped():
    payload = b"Symbol,Side,Quantity,Price,Open Time,Broker\nEURUSD,buy,1,1.1,2024-01-02 10:00:00,AvaTrade\n"
    preview = build_preview("trades.csv", payload)
    assert "Broker" not in preview.mapping.values()
    assert preview.rows[0]["status"] == "valid"


def test_journal_columns_are_copied_onto_the_trade():
    trade = SimpleNamespace(
        notes=None,
        emotion_tags=[],
        strategy_name=None,
        setup_tag=None,
        setup_tags=[],
        pnl=None,
        funding=None,
        commission=Decimal("1"),
        swap=Decimal("0"),
        fees=Decimal("1"),
        leverage=None,
        stop_loss=None,
        asset_type=None,
    )
    apply_journal(
        trade,
        [
            {
                "notes": "Waited for the level",
                "emotions": "FOMO, Anxious",
                "strategy": "Breakout",
                "pnl": "-12.5",
                "leverage": "1:100",
                "stop_loss": "99",
                "asset_type": "forex",
            }
        ],
    )
    assert trade.notes == "Waited for the level"
    assert trade.emotion_tags == ["FOMO", "Anxious"]
    assert trade.strategy_name == "Breakout"
    assert trade.pnl == Decimal("-12.5")
    assert trade.leverage == Decimal("100")
    assert trade.stop_loss == Decimal("99")
    assert trade.asset_type.value == "forex"


def test_exit_only_sell_becomes_one_fill():
    row = SimpleNamespace(
        row_number=2,
        raw={"Type": "sell"},
        normalized={
            "symbol": "GBPUSD",
            "side": "sell",
            "quantity": "1",
            "price": None,
            "exit_price": "1.27",
            "executed_at": None,
            "closed_at": "2026-10-08T09:15:00+00:00",
            "commission": None,
            "swap": None,
            "external_id": None,
        },
    )
    fills, error = executions_for_row(row)
    assert error is None
    assert len(fills) == 1
    assert fills[0].side == "sell"
    assert fills[0].price == Decimal("1.27")
    assert fills[0].external_position_id is None
