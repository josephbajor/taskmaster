from __future__ import annotations

import uuid
from typing import Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from taskmaster.api.resources.tasks.types.create_task_request import CreateTaskRequest
from taskmaster.api.resources.tasks.types.update_task_request import UpdateTaskRequest
from taskmaster.api.resources.tasks.types.task import Task as ApiTask
from taskmaster.api.resources.tasks.types.task_status import TaskStatus as ApiTaskStatus
from taskmaster.db.models.task import TaskRow, TaskStatusEnum


def _map_status_to_api(status: TaskStatusEnum) -> ApiTaskStatus:
    return ApiTaskStatus(status.value)


def _to_api_task(row: TaskRow) -> ApiTask:
    return ApiTask(
        id=row.id,
        title=row.title,
        description=row.description,
        status=_map_status_to_api(row.status),
        priority=row.priority,
        duration_seconds=row.duration_seconds,
        prerequisite_tasks=[t.id for t in row.prerequisites],
        deadline=row.deadline,
    )


def get_task_by_title(session: Session, *, title: str) -> Optional[TaskRow]:
    stmt = (
        select(TaskRow)
        .where(TaskRow.title == title)
        .options(selectinload(TaskRow.prerequisites))
        .limit(1)
    )
    result = session.execute(stmt)
    return result.scalars().first()


def list_tasks(session: Session) -> List[ApiTask]:
    stmt = select(TaskRow).options(selectinload(TaskRow.prerequisites))
    result = session.execute(stmt)
    rows = list(result.scalars().all())
    return [_to_api_task(r) for r in rows]


def _load_prerequisites_by_ids(
    session: Session, ids: Iterable[uuid.UUID]
) -> List[TaskRow]:
    if not ids:
        return []
    stmt = select(TaskRow).where(TaskRow.id.in_(list(ids)))
    result = session.execute(stmt)
    return list(result.scalars().all())


def _map_status_from_api(status: ApiTaskStatus) -> TaskStatusEnum:
    return TaskStatusEnum(status.value)


def create_task(session: Session, *, body: CreateTaskRequest) -> ApiTask:
    row = TaskRow(
        title=body.title,
        description=body.description,
        status=_map_status_from_api(body.status),
        priority=body.priority,
        duration_seconds=body.duration_seconds,
        deadline=body.deadline,
    )
    if body.prerequisite_tasks:
        prereq_rows = _load_prerequisites_by_ids(session, body.prerequisite_tasks)
        if len(prereq_rows) != len(set(body.prerequisite_tasks)):
            raise ValueError("One or more prerequisite tasks do not exist")
        row.prerequisites = prereq_rows

    session.add(row)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise ValueError("Task with this title already exists or invalid data") from exc
    session.refresh(row)
    return _to_api_task(row)


def update_task_by_title(
    session: Session, *, title: str, body: UpdateTaskRequest
) -> Optional[ApiTask]:
    row = get_task_by_title(session, title=title)
    if row is None:
        return None

    if body.description is not None:
        row.description = body.description
    if body.status is not None:
        row.status = _map_status_from_api(body.status)
    if body.priority is not None:
        row.priority = body.priority
    if body.duration_seconds is not None:
        row.duration_seconds = body.duration_seconds
    if body.deadline is not None:
        row.deadline = body.deadline
    if body.prerequisite_tasks is not None:
        prereq_rows = _load_prerequisites_by_ids(session, body.prerequisite_tasks)
        if len(prereq_rows) != len(set(body.prerequisite_tasks)):
            raise ValueError("One or more prerequisite tasks do not exist")
        row.prerequisites = prereq_rows

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise ValueError("Task update failed due to invalid data") from exc
    session.refresh(row)
    return _to_api_task(row)


def delete_task_by_title(session: Session, *, title: str) -> Optional[ApiTask]:
    row = get_task_by_title(session, title=title)
    if row is None:
        return None
    api_task = _to_api_task(row)
    session.delete(row)
    session.commit()
    return api_task
