"""Run data-wait state, coverage version, and cache source (backtesting follow-up F1).

Revision ID: 0038
Revises: 0037
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_STATUS = "status IN ('queued', 'running', 'waiting_data', 'succeeded', 'failed', 'cancelled')"
_OLD_STATUS = "status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')"


def upgrade() -> None:
    op.add_column("backtest_runs", sa.Column("error_code", sa.String(64)))
    op.add_column("backtest_runs", sa.Column("data_job_id", postgresql.UUID(as_uuid=True)))
    op.add_column("backtest_runs", sa.Column("waiting_since", sa.DateTime(timezone=True)))
    op.add_column("backtest_runs", sa.Column("first_bar_ms", sa.BigInteger()))
    op.add_column("backtest_runs", sa.Column("last_bar_ms", sa.BigInteger()))
    op.add_column("backtest_runs", sa.Column("warmup_bars", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("backtest_runs", sa.Column("coverage_version", sa.String(64)))
    op.add_column("backtest_runs", sa.Column("cached_from_run_id", postgresql.UUID(as_uuid=True)))
    op.add_column("backtest_runs", sa.Column("served_from_cache", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("backtest_runs", sa.Column("skip_counts", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.create_foreign_key(
        "fk_backtest_runs_cached_from",
        "backtest_runs",
        "backtest_runs",
        ["cached_from_run_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_constraint("ck_bt_run_status", "backtest_runs", type_="check")
    op.create_check_constraint("ck_bt_run_status", "backtest_runs", _NEW_STATUS)


def downgrade() -> None:
    op.execute("UPDATE backtest_runs SET status = 'failed' WHERE status = 'waiting_data'")
    op.drop_constraint("ck_bt_run_status", "backtest_runs", type_="check")
    op.create_check_constraint("ck_bt_run_status", "backtest_runs", _OLD_STATUS)
    op.drop_constraint("fk_backtest_runs_cached_from", "backtest_runs", type_="foreignkey")
    op.drop_column("backtest_runs", "skip_counts")
    op.drop_column("backtest_runs", "served_from_cache")
    op.drop_column("backtest_runs", "cached_from_run_id")
    op.drop_column("backtest_runs", "coverage_version")
    op.drop_column("backtest_runs", "warmup_bars")
    op.drop_column("backtest_runs", "last_bar_ms")
    op.drop_column("backtest_runs", "first_bar_ms")
    op.drop_column("backtest_runs", "waiting_since")
    op.drop_column("backtest_runs", "data_job_id")
    op.drop_column("backtest_runs", "error_code")
