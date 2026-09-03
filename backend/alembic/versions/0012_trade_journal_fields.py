"""Trade journal fields, masters, precheck lists, and partial executions

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TRADE_COLUMNS: list[tuple[str, sa.Column]] = [
    ("session", sa.Column("session", sa.String(64), nullable=True)),
    ("trade_type", sa.Column("trade_type", sa.String(64), nullable=True)),
    ("option_type", sa.Column("option_type", sa.String(16), nullable=True)),
    ("analysis_timeframe", sa.Column("analysis_timeframe", sa.String(32), nullable=True)),
    ("entry_timeframe", sa.Column("entry_timeframe", sa.String(32), nullable=True)),
    ("stop_loss", sa.Column("stop_loss", sa.Numeric(18, 6), nullable=True)),
    ("invested_amount", sa.Column("invested_amount", sa.Numeric(18, 2), nullable=True)),
    ("entry_condition", sa.Column("entry_condition", sa.String(120), nullable=True)),
    ("exit_condition", sa.Column("exit_condition", sa.String(120), nullable=True)),
    ("sell_quantity", sa.Column("sell_quantity", sa.Numeric(18, 6), nullable=True)),
    ("total_sell_amount", sa.Column("total_sell_amount", sa.Numeric(18, 2), nullable=True)),
    ("leverage", sa.Column("leverage", sa.Numeric(18, 4), nullable=True)),
    ("contract_size", sa.Column("contract_size", sa.Numeric(18, 4), nullable=True)),
    ("is_favourite", sa.Column("is_favourite", sa.Boolean(), nullable=False, server_default=sa.text("false"))),
    ("is_deleted", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false"))),
    ("is_sync", sa.Column("is_sync", sa.Boolean(), nullable=False, server_default=sa.text("false"))),
    ("is_close", sa.Column("is_close", sa.Boolean(), nullable=False, server_default=sa.text("false"))),
    ("is_equity", sa.Column("is_equity", sa.Boolean(), nullable=False, server_default=sa.text("false"))),
    ("year", sa.Column("year", sa.Integer(), nullable=True)),
    ("month", sa.Column("month", sa.Integer(), nullable=True)),
    ("strategy_name", sa.Column("strategy_name", sa.String(120), nullable=True)),
    ("strategy_id", sa.Column("strategy_id", postgresql.UUID(as_uuid=True), nullable=True)),
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    master_category = postgresql.ENUM(
        "symbol",
        "entry_condition",
        "exit_condition",
        "timeframe",
        "session",
        "trade_type",
        "mood",
        "strategy",
        name="master_category",
        create_type=False,
    )
    execution_leg_type = postgresql.ENUM(
        "entry",
        "exit",
        name="execution_leg_type",
        create_type=False,
    )
    master_category.create(bind, checkfirst=True)
    execution_leg_type.create(bind, checkfirst=True)

    if "trade_masters" not in inspector.get_table_names():
        op.create_table(
            "trade_masters",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("category", master_category, nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "category", "name", name="uq_trade_masters_user_category_name"),
        )
        op.create_index("ix_trade_masters_user_id", "trade_masters", ["user_id"])
        op.create_index("ix_trade_masters_category", "trade_masters", ["category"])

    if "precheck_lists" not in inspector.get_table_names():
        op.create_table(
            "precheck_lists",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column("items", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_precheck_lists_user_id", "precheck_lists", ["user_id"])

    trade_cols = {col["name"] for col in inspector.get_columns("trades")}
    for name, column in _TRADE_COLUMNS:
        if name not in trade_cols:
            op.add_column("trades", column)

    trade_cols = {col["name"] for col in inspect(bind).get_columns("trades")}
    if "precheck_list_id" not in trade_cols:
        op.add_column(
            "trades",
            sa.Column(
                "precheck_list_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("precheck_lists.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )

    op.execute(
        """
        UPDATE trades
        SET
            year = EXTRACT(YEAR FROM opened_at)::int,
            month = EXTRACT(MONTH FROM opened_at)::int,
            is_close = (status = 'closed'),
            is_equity = (asset_type = 'stock'),
            sell_quantity = CASE WHEN exit_price IS NOT NULL THEN quantity ELSE sell_quantity END,
            strategy_name = COALESCE(strategy_name, setup_tag)
        """
    )

    if "ix_trades_is_deleted" not in {i["name"] for i in inspect(bind).get_indexes("trades")}:
        op.create_index("ix_trades_is_deleted", "trades", ["is_deleted"])
    if "ix_trades_year" not in {i["name"] for i in inspect(bind).get_indexes("trades")}:
        op.create_index("ix_trades_year", "trades", ["year"])
    if "ix_trades_month" not in {i["name"] for i in inspect(bind).get_indexes("trades")}:
        op.create_index("ix_trades_month", "trades", ["month"])

    if "trade_executions" not in inspect(bind).get_table_names():
        op.create_table(
            "trade_executions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("trade_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trades.id", ondelete="CASCADE"), nullable=False),
            sa.Column("leg_type", execution_leg_type, nullable=False),
            sa.Column("quantity", sa.Numeric(18, 6), nullable=False),
            sa.Column("price", sa.Numeric(18, 6), nullable=False),
            sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("fees", sa.Numeric(18, 4), nullable=False, server_default="0"),
            sa.Column("condition", sa.String(120), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_trade_executions_trade_id", "trade_executions", ["trade_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "trade_executions" in inspector.get_table_names():
        op.drop_table("trade_executions")

    trade_cols = {col["name"] for col in inspector.get_columns("trades")}
    for name in (
        "precheck_list_id",
        "strategy_id",
        "strategy_name",
        "month",
        "year",
        "is_equity",
        "is_close",
        "is_sync",
        "is_deleted",
        "is_favourite",
        "contract_size",
        "leverage",
        "total_sell_amount",
        "sell_quantity",
        "exit_condition",
        "entry_condition",
        "invested_amount",
        "stop_loss",
        "entry_timeframe",
        "analysis_timeframe",
        "option_type",
        "trade_type",
        "session",
    ):
        if name in trade_cols:
            op.drop_column("trades", name)

    if "precheck_lists" in inspect(bind).get_table_names():
        op.drop_table("precheck_lists")
    if "trade_masters" in inspect(bind).get_table_names():
        op.drop_table("trade_masters")

    postgresql.ENUM(name="execution_leg_type").drop(bind, checkfirst=True)
    postgresql.ENUM(name="master_category").drop(bind, checkfirst=True)
