"""progress tracker settings, versions, manual rules, completions, results

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-16

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "progress_tracker_settings" not in tables:
        op.create_table(
            "progress_tracker_settings",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("active_days", postgresql.JSONB(), nullable=False, server_default='["mon","tue","wed","thu","fri"]'),
            sa.Column("reminder_enabled", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("reminder_time", sa.String(5), nullable=False, server_default="20:15"),
            sa.Column("trading_hours_enabled", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("trading_start_time", sa.String(5), nullable=False, server_default="09:30"),
            sa.Column("trading_end_time", sa.String(5), nullable=False, server_default="16:00"),
            sa.Column("start_day_enabled", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("start_day_time", sa.String(5), nullable=False, server_default="09:00"),
            sa.Column("link_playbook_enabled", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("stop_loss_required", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("max_loss_per_trade_enabled", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("max_loss_per_trade_mode", sa.String(16), nullable=False, server_default="amount"),
            sa.Column("max_loss_per_trade_value", sa.Numeric(18, 4), nullable=False, server_default="0"),
            sa.Column("max_loss_per_day_enabled", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("max_loss_per_day_value", sa.Numeric(18, 2), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_progress_tracker_settings_user_id", "progress_tracker_settings", ["user_id"], unique=True)

    if "progress_tracker_config_versions" not in tables:
        op.create_table(
            "progress_tracker_config_versions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("effective_from", sa.Date(), nullable=False),
            sa.Column("snapshot", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_progress_tracker_config_versions_user_id", "progress_tracker_config_versions", ["user_id"])
        op.create_index(
            "ix_progress_tracker_config_versions_user_from",
            "progress_tracker_config_versions",
            ["user_id", "effective_from"],
        )

    if "progress_tracker_manual_rules" not in tables:
        op.create_table(
            "progress_tracker_manual_rules",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("name", sa.String(160), nullable=False),
            sa.Column("schedule", postgresql.JSONB(), nullable=False, server_default='["mon","tue","wed","thu","fri"]'),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_progress_tracker_manual_rules_user_id", "progress_tracker_manual_rules", ["user_id"])
        op.create_index(
            "ix_progress_tracker_manual_rules_user_active",
            "progress_tracker_manual_rules",
            ["user_id", "is_deleted", "sort_order"],
        )

    if "progress_tracker_manual_completions" not in tables:
        op.create_table(
            "progress_tracker_manual_completions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "rule_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("progress_tracker_manual_rules.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("completed", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "rule_id", "date", name="uq_progress_tracker_completion_user_rule_date"),
        )
        op.create_index("ix_progress_tracker_manual_completions_user_id", "progress_tracker_manual_completions", ["user_id"])
        op.create_index("ix_progress_tracker_manual_completions_date", "progress_tracker_manual_completions", ["date"])
        op.create_index(
            "ix_progress_tracker_manual_completions_user_date",
            "progress_tracker_manual_completions",
            ["user_id", "date"],
        )

    if "progress_tracker_day_starts" not in tables:
        op.create_table(
            "progress_tracker_day_starts",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "date", name="uq_progress_tracker_day_starts_user_date"),
        )
        op.create_index("ix_progress_tracker_day_starts_user_id", "progress_tracker_day_starts", ["user_id"])
        op.create_index("ix_progress_tracker_day_starts_date", "progress_tracker_day_starts", ["date"])

    if "progress_tracker_daily_results" not in tables:
        op.create_table(
            "progress_tracker_daily_results",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column(
                "account_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("accounts.id", ondelete="CASCADE"),
                nullable=True,
            ),
            sa.Column(
                "config_version_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("progress_tracker_config_versions.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("total_rules", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("passed_rules", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("failed_rules", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("pending_rules", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("not_applicable_rules", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("score", sa.Numeric(6, 2), nullable=True),
            sa.Column("participated", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("results", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("evaluated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_progress_tracker_daily_results_user_id", "progress_tracker_daily_results", ["user_id"])
        op.create_index("ix_progress_tracker_daily_results_date", "progress_tracker_daily_results", ["date"])
        op.create_index(
            "ix_progress_tracker_daily_results_user_date",
            "progress_tracker_daily_results",
            ["user_id", "date"],
        )
        op.create_index(
            "uq_progress_tracker_daily_results_all",
            "progress_tracker_daily_results",
            ["user_id", "date"],
            unique=True,
            postgresql_where=sa.text("account_id IS NULL"),
        )
        op.create_index(
            "uq_progress_tracker_daily_results_acct",
            "progress_tracker_daily_results",
            ["user_id", "date", "account_id"],
            unique=True,
            postgresql_where=sa.text("account_id IS NOT NULL"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    for name in (
        "progress_tracker_daily_results",
        "progress_tracker_day_starts",
        "progress_tracker_manual_completions",
        "progress_tracker_manual_rules",
        "progress_tracker_config_versions",
        "progress_tracker_settings",
    ):
        if name in tables:
            op.drop_table(name)
