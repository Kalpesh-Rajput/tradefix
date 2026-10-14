"""Upgrade -> downgrade -> upgrade round trip for every backtesting migration (D-016)."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from tests.bt_support import ENGINE, requires_db

pytestmark = requires_db

BACKEND = Path(__file__).resolve().parents[1]

# revision -> (parent, tables created, (table, column) pairs added)
MIGRATIONS = {
    "0033": (
        "0032",
        ["instruments", "symbol_aliases", "unresolved_symbols", "candle_coverage", "candle_month_stats", "jobs", "worker_heartbeats"],
        [("trades", "is_simulated"), ("trades", "time_basis")],
    ),
}


def _config() -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    return cfg


def _schema():
    insp = inspect(ENGINE)
    tables = set(insp.get_table_names())
    return tables, {t: {c["name"] for c in insp.get_columns(t)} for t in ("trades",)}


@pytest.mark.parametrize("revision", sorted(MIGRATIONS))
def test_round_trip(revision):
    parent, tables, columns = MIGRATIONS[revision]
    cfg = _config()
    command.upgrade(cfg, "head")
    try:
        command.downgrade(cfg, parent)
        present, cols = _schema()
        assert not set(tables) & present
        for table, column in columns:
            assert column not in cols.get(table, set())
    finally:
        command.upgrade(cfg, "head")
    present, cols = _schema()
    assert set(tables) <= present
    for table, column in columns:
        assert column in cols[table]
