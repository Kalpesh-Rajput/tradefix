"""AI chat usage logs, RAG documents, trade session index

Revision ID: 0023
Revises: 0022
Create Date: 2026-09-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    try:
        bind.execute(text("SAVEPOINT ai_vector_ext"))
        bind.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        bind.execute(text("RELEASE SAVEPOINT ai_vector_ext"))
    except Exception:
        bind.execute(text("ROLLBACK TO SAVEPOINT ai_vector_ext"))

    if "ai_documents" not in tables:
        op.create_table(
            "ai_documents",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("source_type", sa.String(32), nullable=False),
            sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("content", sa.Text(), nullable=False, server_default=""),
            sa.Column("content_hash", sa.String(64), nullable=False, server_default=""),
            sa.Column("embedding", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "source_type", "source_id", name="uq_ai_documents_user_source"),
        )
        op.create_index("ix_ai_documents_user_id", "ai_documents", ["user_id"])
        op.create_index("ix_ai_documents_source_type", "ai_documents", ["source_type"])
        op.create_index("ix_ai_documents_user_source_type", "ai_documents", ["user_id", "source_type"])

    if "ai_usage_logs" not in tables:
        op.create_table(
            "ai_usage_logs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("model", sa.String(160), nullable=True),
            sa.Column("input_tokens", sa.Integer(), nullable=True),
            sa.Column("output_tokens", sa.Integer(), nullable=True),
            sa.Column("total_tokens", sa.Integer(), nullable=True),
            sa.Column("request_type", sa.String(32), nullable=False, server_default="chat"),
            sa.Column("intent", sa.String(32), nullable=True),
            sa.Column("tools_used", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("success", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("error_code", sa.String(64), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_ai_usage_logs_user_id", "ai_usage_logs", ["user_id"])
        op.create_index("ix_ai_usage_logs_request_id", "ai_usage_logs", ["request_id"])
        op.create_index("ix_ai_usage_logs_created_at", "ai_usage_logs", ["created_at"])

    if "trades" in tables:
        trade_indexes = {idx["name"] for idx in inspector.get_indexes("trades")}
        if "ix_trades_session" not in trade_indexes:
            op.create_index("ix_trades_session", "trades", ["session"])
        if "ix_trades_user_opened_at" not in trade_indexes:
            op.create_index("ix_trades_user_opened_at", "trades", ["user_id", "opened_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "trades" in tables:
        trade_indexes = {idx["name"] for idx in inspector.get_indexes("trades")}
        if "ix_trades_user_opened_at" in trade_indexes:
            op.drop_index("ix_trades_user_opened_at", table_name="trades")
        if "ix_trades_session" in trade_indexes:
            op.drop_index("ix_trades_session", table_name="trades")
    if "ai_usage_logs" in tables:
        op.drop_table("ai_usage_logs")
    if "ai_documents" in tables:
        op.drop_table("ai_documents")
