from __future__ import annotations

from fastapi.testclient import TestClient
from taskmaster.api.resources.tasks.types.task_status import TaskStatus


def test_api_create_and_list_tasks(client: TestClient) -> None:
    resp = client.post(
        "/api/create-task",
        json={
            "title": "api-task-a",
            "description": "desc",
            "status": TaskStatus.TODO.value,
            "priority": 1,
            "duration_seconds": 45,
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["title"] == "api-task-a"

    resp_list = client.get("/api/get-tasks")
    assert resp_list.status_code == 200
    titles = {t["title"] for t in resp_list.json()}
    assert "api-task-a" in titles


def test_api_update_and_delete_task(client: TestClient) -> None:
    # create
    client.post(
        "/api/create-task",
        json={
            "title": "api-task-b",
            "description": "d",
            "status": TaskStatus.TODO.value,
            "priority": 1,
            "duration_seconds": 60,
        },
    )
    # update
    resp_upd = client.post(
        "/api/update-task",
        json={
            "title": "api-task-b",
            "description": "new",
            "status": TaskStatus.IN_PROGRESS.value,
        },
    )
    assert resp_upd.status_code == 200
    assert resp_upd.json()["description"] == "new"

    # delete
    resp_del = client.post("/api/delete-task", json={"title": "api-task-b"})
    assert resp_del.status_code in (200, 404)
