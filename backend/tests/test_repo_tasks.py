from __future__ import annotations

import uuid
import pytest
from sqlalchemy.orm import Session

from taskmaster.services.task_management import repo
from taskmaster.api.resources.tasks.types.create_task_request import CreateTaskRequest
from taskmaster.api.resources.tasks.types.update_task_request import UpdateTaskRequest
from taskmaster.api.resources.tasks.types.task_status import TaskStatus


@pytest.mark.usefixtures("db_session")
def test_create_and_get_list_tasks(db_session: Session) -> None:
    created = repo.create_task(
        db_session,
        body=CreateTaskRequest(
            title="task-a",
            description="desc",
            status=TaskStatus.TODO,
            priority=1,
            duration_seconds=120,
        ),
    )
    assert created.title == "task-a"
    assert created.status == TaskStatus.TODO

    tasks = repo.list_tasks(db_session)
    titles = {t.title for t in tasks}
    assert "task-a" in titles


@pytest.mark.usefixtures("db_session")
def test_update_task_by_title(db_session: Session) -> None:
    repo.create_task(
        db_session,
        body=CreateTaskRequest(
            title="task-b",
            description="d",
            status=TaskStatus.TODO,
            priority=1,
            duration_seconds=30,
        ),
    )
    updated = repo.update_task_by_title(
        db_session,
        title="task-b",
        body=UpdateTaskRequest(title="task-b", description="new", status=TaskStatus.IN_PROGRESS),
    )
    assert updated is not None
    assert updated.description == "new"
    assert updated.status == TaskStatus.IN_PROGRESS


@pytest.mark.usefixtures("db_session")
def test_prerequisites_validation(db_session: Session) -> None:
    with pytest.raises(ValueError):
        repo.create_task(
            db_session,
            body=CreateTaskRequest(
                title="task-c",
                description="d",
                status=TaskStatus.TODO,
                priority=1,
                duration_seconds=30,
                prerequisite_tasks=[uuid.uuid4()],
            ),
        )


@pytest.mark.usefixtures("db_session")
def test_delete_task_by_title(db_session: Session) -> None:
    repo.create_task(
        db_session,
        body=CreateTaskRequest(
            title="task-d",
            description="d",
            status=TaskStatus.TODO,
            priority=1,
            duration_seconds=60,
        ),
    )
    deleted = repo.delete_task_by_title(db_session, title="task-d")
    assert deleted is not None
    assert repo.get_task_by_title(db_session, title="task-d") is None
