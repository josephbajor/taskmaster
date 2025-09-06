from taskmaster.api.resources.tasks.service.service import AbstractTasksService
from taskmaster.api.resources.tasks.types.task import Task
from taskmaster.api.resources.tasks.types.create_task_request import CreateTaskRequest
from taskmaster.api.resources.tasks.types.update_task_request import UpdateTaskRequest
from taskmaster.api.resources.tasks.types.delete_task_request import DeleteTaskRequest
from taskmaster.api.resources.tasks.types.generate_tasks_request import (
    GenerateTasksRequest,
)
from taskmaster.api.resources.tasks.types.generate_tasks_response import (
    GenerateTasksResponse,
)
from taskmaster.api.core.exceptions.fern_http_exception import FernHTTPException
from taskmaster.db.session import get_db_session
from sqlalchemy.orm import Session
import fastapi

from taskmaster.services.task_management import repo
from taskmaster.services.task_management.generation.agent import (
    generate_tasks_with_agent,
)


class TasksService(AbstractTasksService):
    def __init__(self, db: Session = fastapi.Depends(get_db_session)) -> None:
        self._db = db

    def create_task(self, *, body: CreateTaskRequest) -> Task:
        try:
            return repo.create_task(self._db, body=body)
        except ValueError as exc:
            raise FernHTTPException(status_code=400, content=str(exc))

    def update_task(self, *, body: UpdateTaskRequest) -> Task:
        try:
            updated = repo.update_task_by_title(self._db, title=body.title, body=body)
        except ValueError as exc:
            raise FernHTTPException(status_code=400, content=str(exc))
        if updated is None:
            raise FernHTTPException(status_code=404, content="Task not found")
        return updated

    def delete_task(self, *, body: DeleteTaskRequest) -> Task:
        deleted = repo.delete_task_by_title(self._db, title=body.title)
        if deleted is None:
            raise FernHTTPException(status_code=404, content="Task not found")
        return deleted

    def get_tasks(self) -> list[Task]:
        return repo.list_tasks(self._db)

    def generate_tasks(self, *, body: GenerateTasksRequest) -> GenerateTasksResponse:
        # Ensure existing tasks are available to the agent
        if body.existing_tasks is None:
            body.existing_tasks = repo.list_tasks(self._db)
        # Run multi-turn GPT-5 agent to perform task mutations via MCP tools
        resp = generate_tasks_with_agent(body)
        # If agent didn't return tasks, fall back to listing current tasks
        tasks = resp.tasks or repo.list_tasks(self._db)
        return GenerateTasksResponse(tasks=tasks)
