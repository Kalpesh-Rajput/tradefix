"""Broker connections, raw records, sync jobs, and import batches.

Revision ID: 0029
Revises: 0028
Create Date: 2026-10-06

Additive only. Existing trades and accounts are kept.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "broker_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("environment", sa.String(16), nullable=False, server_default="live"),
        sa.Column("region", sa.String(32), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("paused", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sync_interval_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("history_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("history_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("realtime_status", sa.String(32), nullable=False, server_default="off"),
        sa.Column("last_error_code", sa.String(64), nullable=True),
        sa.Column("display_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_broker_connections_user_id", "broker_connections", ["user_id"])
    op.create_index("ix_broker_connections_provider", "broker_connections", ["provider"])

    op.create_table(
        "broker_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("connection_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("broker_connections.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("key_id", sa.String(64), nullable=False),
        sa.Column("nonce", sa.LargeBinary(), nullable=False),
        sa.Column("ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_broker_credentials_user_id", "broker_credentials", ["user_id"])

    op.create_table(
        "broker_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("connection_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("broker_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("external_account_id", sa.String(128), nullable=False),
        sa.Column("masked_id", sa.String(64), nullable=False),
        sa.Column("account_type", sa.String(32), nullable=True),
        sa.Column("currency", sa.String(16), nullable=False, server_default="USD"),
        sa.Column("balance", sa.Numeric(24, 8), nullable=True),
        sa.Column("equity", sa.Numeric(24, 8), nullable=True),
        sa.Column("is_selected", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("connection_id", "external_account_id", name="uq_broker_account_external"),
    )
    op.create_index("ix_broker_accounts_user_id", "broker_accounts", ["user_id"])
    op.create_index("ix_broker_accounts_connection_id", "broker_accounts", ["connection_id"])

    op.create_table(
        "raw_provider_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("broker_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sync_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("record_type", sa.String(32), nullable=False),
        sa.Column("external_id", sa.String(160), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("broker_account_id", "record_type", "external_id", "payload_hash", name="uq_raw_provider_record"),
    )
    op.create_index("ix_raw_provider_records_user_id", "raw_provider_records", ["user_id"])
    op.create_index("ix_raw_provider_records_broker_account_id", "raw_provider_records", ["broker_account_id"])
    op.execute(
        """
        CREATE OR REPLACE FUNCTION broker_raw_immutable() RETURNS trigger AS $$
        BEGIN
          IF TG_OP = 'DELETE' AND current_setting('tradefix.allow_raw_delete', true) = 'on' THEN
            RETURN OLD;
          END IF;
          RAISE EXCEPTION 'raw_provider_records are immutable';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER raw_provider_records_no_mutate
        BEFORE UPDATE OR DELETE ON raw_provider_records
        FOR EACH ROW EXECUTE FUNCTION broker_raw_immutable();
        """
    )

    op.create_table(
        "broker_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("broker_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_order_id", sa.String(160), nullable=False),
        sa.Column("provider_symbol", sa.String(64), nullable=False),
        sa.Column("canonical_symbol", sa.String(64), nullable=False),
        sa.Column("side", sa.String(16), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="unknown"),
        sa.Column("quantity", sa.Numeric(24, 8), nullable=False, server_default="0"),
        sa.Column("price", sa.Numeric(24, 8), nullable=True),
        sa.Column("raw_record_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("broker_account_id", "external_order_id", name="uq_broker_order_external"),
    )
    op.create_index("ix_broker_orders_user_id", "broker_orders", ["user_id"])
    op.create_index("ix_broker_orders_broker_account_id", "broker_orders", ["broker_account_id"])

    op.create_table(
        "broker_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("broker_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_execution_id", sa.String(160), nullable=False),
        sa.Column("external_order_id", sa.String(160), nullable=True),
        sa.Column("external_position_id", sa.String(160), nullable=True),
        sa.Column("provider_symbol", sa.String(64), nullable=False),
        sa.Column("canonical_symbol", sa.String(64), nullable=False),
        sa.Column("side", sa.String(16), nullable=False),
        sa.Column("quantity", sa.Numeric(24, 8), nullable=False),
        sa.Column("price", sa.Numeric(24, 8), nullable=False),
        sa.Column("commission", sa.Numeric(24, 8), nullable=False, server_default="0"),
        sa.Column("swap", sa.Numeric(24, 8), nullable=False, server_default="0"),
        sa.Column("funding", sa.Numeric(24, 8), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(16), nullable=False, server_default="USD"),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("identity_rank", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("raw_record_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("broker_account_id", "external_execution_id", name="uq_broker_execution_external"),
    )
    op.create_index("ix_broker_executions_user_id", "broker_executions", ["user_id"])
    op.create_index("ix_broker_executions_executed_at", "broker_executions", ["executed_at"])
    op.create_index("ix_broker_executions_external_order_id", "broker_executions", ["external_order_id"])
    op.create_index("ix_broker_executions_external_position_id", "broker_executions", ["external_position_id"])

    op.create_table(
        "broker_positions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("broker_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_position_id", sa.String(160), nullable=False),
        sa.Column("provider_symbol", sa.String(64), nullable=False),
        sa.Column("canonical_symbol", sa.String(64), nullable=False),
        sa.Column("side", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("quantity", sa.Numeric(24, 8), nullable=False, server_default="0"),
        sa.Column("entry_price", sa.Numeric(24, 8), nullable=True),
        sa.Column("exit_price", sa.Numeric(24, 8), nullable=True),
        sa.Column("gross_pnl", sa.Numeric(24, 8), nullable=True),
        sa.Column("net_pnl", sa.Numeric(24, 8), nullable=True),
        sa.Column("commission", sa.Numeric(24, 8), nullable=False, server_default="0"),
        sa.Column("swap", sa.Numeric(24, 8), nullable=False, server_default="0"),
        sa.Column("funding", sa.Numeric(24, 8), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(16), nullable=False, server_default="USD"),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_record_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("broker_account_id", "external_position_id", name="uq_broker_position_external"),
    )
    op.create_index("ix_broker_positions_user_id", "broker_positions", ["user_id"])

    op.create_table(
        "sync_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("worker_id", sa.String(64), nullable=True),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("job_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("job_timeout_seconds", sa.Integer(), nullable=False, server_default="3600"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sync_jobs_status", "sync_jobs", ["status"])
    op.create_index("ix_sync_jobs_connection_id", "sync_jobs", ["connection_id"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_sync_job_active
        ON sync_jobs (connection_id)
        WHERE status IN ('queued', 'running')
        """
    )

    op.create_table(
        "sync_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("records_received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sync_runs_connection_id", "sync_runs", ["connection_id"])

    op.create_table(
        "sync_checkpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stream", sa.String(64), nullable=False),
        sa.Column("cursor", sa.Text(), nullable=True),
        sa.Column("page", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("connection_id", "stream", name="uq_sync_checkpoint_stream"),
    )

    op.create_table(
        "sync_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sync_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step", sa.String(64), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sync_events_sync_run_id", "sync_events", ["sync_run_id"])

    op.create_table(
        "broker_workers",
        sa.Column("worker_id", sa.String(64), primary_key=True),
        sa.Column("kind", sa.String(32), nullable=False, server_default="sync"),
        sa.Column("host", sa.String(120), nullable=False, server_default=""),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("detected_format", sa.String(64), nullable=False, server_default="unknown"),
        sa.Column("status", sa.String(32), nullable=False, server_default="preview"),
        sa.Column("mapping", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attention_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "import_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="valid"),
        sa.Column("errors", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("raw", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("normalized", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_import_rows_batch_id", "import_rows", ["batch_id"])

    op.create_table(
        "broker_oauth_states",
        sa.Column("state", sa.String(128), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.add_column("trades", sa.Column("source", sa.String(32), nullable=False, server_default="manual"))
    op.add_column("trades", sa.Column("broker_account_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("trades", sa.Column("broker_position_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("trades", sa.Column("external_trade_id", sa.String(160), nullable=True))
    op.add_column("trades", sa.Column("provider_symbol", sa.String(64), nullable=True))
    op.add_column("trades", sa.Column("canonical_symbol", sa.String(64), nullable=True))
    op.add_column("trades", sa.Column("commission", sa.Numeric(18, 8), nullable=True))
    op.add_column("trades", sa.Column("swap", sa.Numeric(18, 8), nullable=True))
    op.add_column("trades", sa.Column("funding", sa.Numeric(18, 8), nullable=True))
    op.add_column("trades", sa.Column("gross_pnl", sa.Numeric(18, 8), nullable=True))
    op.create_index("ix_trades_broker_account_id", "trades", ["broker_account_id"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_trades_broker_external
        ON trades (broker_account_id, external_trade_id)
        WHERE broker_account_id IS NOT NULL AND external_trade_id IS NOT NULL
        """
    )
    op.add_column("trade_executions", sa.Column("broker_execution_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("trade_executions", sa.Column("external_execution_id", sa.String(160), nullable=True))


def downgrade() -> None:
    op.drop_column("trade_executions", "external_execution_id")
    op.drop_column("trade_executions", "broker_execution_id")
    op.execute("DROP INDEX IF EXISTS uq_trades_broker_external")
    op.drop_index("ix_trades_broker_account_id", table_name="trades")
    for col in (
        "gross_pnl",
        "funding",
        "swap",
        "commission",
        "canonical_symbol",
        "provider_symbol",
        "external_trade_id",
        "broker_position_id",
        "broker_account_id",
        "source",
    ):
        op.drop_column("trades", col)
    op.drop_table("broker_oauth_states")
    op.drop_table("import_rows")
    op.drop_table("import_batches")
    op.drop_table("broker_workers")
    op.drop_table("sync_events")
    op.drop_table("sync_checkpoints")
    op.drop_table("sync_runs")
    op.execute("DROP INDEX IF EXISTS uq_sync_job_active")
    op.drop_table("sync_jobs")
    op.drop_table("broker_positions")
    op.drop_table("broker_executions")
    op.drop_table("broker_orders")
    op.execute("DROP TRIGGER IF EXISTS raw_provider_records_no_mutate ON raw_provider_records")
    op.execute("DROP FUNCTION IF EXISTS broker_raw_immutable()")
    op.drop_table("raw_provider_records")
    op.drop_table("broker_accounts")
    op.drop_table("broker_credentials")
    op.drop_table("broker_connections")
