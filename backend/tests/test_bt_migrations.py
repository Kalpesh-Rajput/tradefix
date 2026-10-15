"""Upgrade -> downgrade -> upgrade round trip for every backtesting migration (D-016).

Tests run against the dev database, so rows in the dropped tables and columns are copied aside
before the downgrade and restored afterwards (seeded coverage and simulated-trade flags survive).
"""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from tests.bt_support import ENGINE, requires_db

pytestmark = requires_db

BACKEND = Path(__file__).resolve().parents[1]
BACKUP_PREFIX = "_bt_backup_"

# revision -> (parent, tables created in FK order, (table, column) pairs added)
MIGRATIONS = {
    "0033": (
        "0032",
        ["instruments", "symbol_aliases", "unresolved_symbols", "candle_coverage", "candle_month_stats", "jobs", "worker_heartbeats"],
        [("trades", "is_simulated"), ("trades", "time_basis")],
    ),
    "0034": ("0033", ["account_time_offsets"], []),
    "0035": ("0034", ["trade_replay_notes"], []),
    "0036": ("0035", ["backtest_sessions", "session_orders", "session_trades", "usage_counters"], []),
    "0037": ("0036", ["strategies", "backtest_runs", "backtest_run_trades"], []),
    "0038": (
        "0037",
        [],
        [
            ("backtest_runs", "error_code"),
            ("backtest_runs", "data_job_id"),
            ("backtest_runs", "waiting_since"),
            ("backtest_runs", "first_bar_ms"),
            ("backtest_runs", "last_bar_ms"),
            ("backtest_runs", "warmup_bars"),
            ("backtest_runs", "coverage_version"),
            ("backtest_runs", "cached_from_run_id"),
            ("backtest_runs", "served_from_cache"),
            ("backtest_runs", "skip_counts"),
        ],
    ),
    "0039": (
        "0038",
        ["provider_cooldowns", "candle_imports"],
        [("candle_month_stats", "price_side"), ("candle_month_stats", "sources")],
    ),
    "0040": ("0039", ["crosscheck_results"], []),
}


def _config() -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    return cfg


def _schema():
    insp = inspect(ENGINE)
    tables = set(insp.get_table_names())
    wanted = [name for name in ("trades", "backtest_runs", "candle_month_stats") if name in tables]
    return tables, {t: {c["name"] for c in insp.get_columns(t)} for t in wanted}


def _affected(revision: str) -> tuple[list[str], dict[str, list[str]]]:
    revisions = [r for r in sorted(MIGRATIONS) if r >= revision]
    tables = [t for r in revisions for t in MIGRATIONS[r][1]]
    columns: dict[str, list[str]] = {}
    for r in revisions:
        for table, column in MIGRATIONS[r][2]:
            columns.setdefault(table, []).append(column)
    return tables, columns


def _backup(revision: str) -> None:
    tables, columns = _affected(revision)
    column_only = {table: cols for table, cols in columns.items() if table not in tables}
    with ENGINE.begin() as conn:
        for table in [*tables, *column_only]:
            conn.execute(text(f'DROP TABLE IF EXISTS "{BACKUP_PREFIX}{table}"'))
        for table in tables:
            conn.execute(text(f'CREATE TABLE "{BACKUP_PREFIX}{table}" AS TABLE "{table}"'))
        for table, cols in column_only.items():
            picked = ", ".join(f'"{c}"' for c in cols)
            conn.execute(text(f'CREATE TABLE "{BACKUP_PREFIX}{table}" AS SELECT id, {picked} FROM "{table}"'))


def _restore(revision: str) -> None:
    tables, columns = _affected(revision)
    column_only = {table: cols for table, cols in columns.items() if table not in tables}
    with ENGINE.begin() as conn:
        for table in tables:
            conn.execute(text(f'DELETE FROM "{table}"'))
            conn.execute(text(f'INSERT INTO "{table}" SELECT * FROM "{BACKUP_PREFIX}{table}"'))
        for table, cols in column_only.items():
            assignments = ", ".join(f'"{c}" = b."{c}"' for c in cols)
            conn.execute(text(f'UPDATE "{table}" t SET {assignments} FROM "{BACKUP_PREFIX}{table}" b WHERE t.id = b.id'))
        for table in [*tables, *column_only]:
            conn.execute(text(f'DROP TABLE "{BACKUP_PREFIX}{table}"'))


@pytest.mark.parametrize("revision", sorted(MIGRATIONS))
def test_round_trip(revision):
    parent, tables, columns = MIGRATIONS[revision]
    cfg = _config()
    command.upgrade(cfg, "head")
    _backup(revision)
    try:
        command.downgrade(cfg, parent)
        present, cols = _schema()
        assert not set(tables) & present
        for table, column in columns:
            assert column not in cols.get(table, set())
    finally:
        command.upgrade(cfg, "head")
        _restore(revision)
    present, cols = _schema()
    assert set(tables) <= present
    for table, column in columns:
        assert column in cols[table]


def test_round_trip_keeps_existing_rows():
    with ENGINE.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO worker_heartbeats (name, instance, info) VALUES ('bt_migration_probe', 'test', '{}') "
                "ON CONFLICT (name) DO NOTHING"
            )
        )
    try:
        test_round_trip("0033")
        with ENGINE.connect() as conn:
            kept = conn.execute(text("SELECT count(*) FROM worker_heartbeats WHERE name = 'bt_migration_probe'")).scalar()
        assert kept == 1
    finally:
        with ENGINE.begin() as conn:
            conn.execute(text("DELETE FROM worker_heartbeats WHERE name = 'bt_migration_probe'"))
