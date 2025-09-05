from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import List

from sqlalchemy import (
    UUID,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from taskmaster.db.base import Base


class TaskStatusEnum(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


task_prerequisites = Table(
    "task_prerequisites",
    Base.metadata,
    Column(
        "task_id",
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "prerequisite_task_id",
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
    CheckConstraint("task_id <> prerequisite_task_id", name="ck_task_prereq_no_self"),
)


class TaskRow(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TaskStatusEnum] = mapped_column(
        Enum(TaskStatusEnum, name="task_status"), nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        server_onupdate=func.now(),
        nullable=False,
    )

    prerequisites: Mapped[List["TaskRow"]] = relationship(
        "TaskRow",
        secondary=task_prerequisites,
        primaryjoin=id == task_prerequisites.c.task_id,
        secondaryjoin=id == task_prerequisites.c.prerequisite_task_id,
        backref="dependents",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("title", name="uq_tasks_title"),
        CheckConstraint("priority >= 0", name="ck_tasks_priority_nonneg"),
        CheckConstraint("duration_seconds >= 0", name="ck_tasks_duration_nonneg"),
        Index("ix_tasks_status", "status"),
        Index("ix_tasks_deadline", "deadline"),
    )
