"""create tasks and prerequisites

Revision ID: 20240905_000001
Revises:
Create Date: 2025-09-05 00:00:01

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID


# revision identifiers, used by Alembic.
revision = "20240905_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure ENUM type exists (idempotent)
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
                CREATE TYPE task_status AS ENUM ('TODO','IN_PROGRESS','COMPLETED','CANCELLED');
            END IF;
        END
        $$;
        """
    )

    # Create tasks table
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "status", ENUM(name="task_status", create_type=False), nullable=False
        ),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("title", name="uq_tasks_title"),
    )

    # Check constraints
    op.create_check_constraint("ck_tasks_priority_nonneg", "tasks", "priority >= 0")
    op.create_check_constraint(
        "ck_tasks_duration_nonneg", "tasks", "duration_seconds >= 0"
    )

    # Indexes
    op.create_index("ix_tasks_status", "tasks", ["status"], unique=False)
    op.create_index("ix_tasks_deadline", "tasks", ["deadline"], unique=False)

    # Association table for prerequisites
    op.create_table(
        "task_prerequisites",
        sa.Column(
            "task_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "prerequisite_task_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="RESTRICT"),
            primary_key=True,
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_task_prereq_no_self",
        "task_prerequisites",
        "task_id <> prerequisite_task_id",
    )


def downgrade() -> None:
    op.drop_constraint("ck_task_prereq_no_self", "task_prerequisites", type_="check")
    op.drop_table("task_prerequisites")
    op.drop_index("ix_tasks_deadline", table_name="tasks")
    op.drop_index("ix_tasks_status", table_name="tasks")
    op.drop_constraint("ck_tasks_duration_nonneg", "tasks", type_="check")
    op.drop_constraint("ck_tasks_priority_nonneg", "tasks", type_="check")
    op.drop_table("tasks")
    # Drop ENUM type
    op.execute("DROP TYPE IF EXISTS task_status")
