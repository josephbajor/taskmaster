from taskmaster.api.resources.tasks.service.service import AbstractTasksService
from taskmaster.api.resources.tasks.types.task import Task, TaskStatus
from taskmaster.api.resources.tasks.types.create_task_request import CreateTaskRequest
from taskmaster.api.resources.tasks.types.update_task_request import UpdateTaskRequest
from taskmaster.api.resources.tasks.types.delete_task_request import DeleteTaskRequest
import uuid


class TasksService(AbstractTasksService):
    def create_task(self, *, body: CreateTaskRequest) -> Task:
        return Task(
            id=uuid.uuid4(),
            title=body.title,
            description=body.description,
            status=body.status,
            priority=body.priority,
            duration_seconds=body.duration_seconds,
            prerequisite_tasks=body.prerequisite_tasks,
            deadline=body.deadline,
        )

    def update_task(self, *, body: UpdateTaskRequest) -> Task:
        return Task(
            id=uuid.uuid4(),
            title=body.title,
            description=body.description,
            status=body.status,
            priority=body.priority,
            duration_seconds=body.duration_seconds,
            prerequisite_tasks=body.prerequisite_tasks,
            deadline=body.deadline,
        )

    def delete_task(self, *, body: DeleteTaskRequest) -> Task:
        return NotImplementedError("WIP")

    def get_tasks(self) -> list[Task]:
        return NotImplementedError("WIP")
