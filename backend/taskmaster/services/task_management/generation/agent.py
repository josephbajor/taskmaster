from __future__ import annotations

import json
from typing import Dict, List

from openai import OpenAI

from taskmaster.api.resources.tasks.types.generate_tasks_request import (
    GenerateTasksRequest,
)
from taskmaster.api.resources.tasks.types.generate_tasks_response import (
    GenerateTasksResponse,
)
from taskmaster.api.resources.tasks.types.task import Task
from taskmaster.config import get_settings
from taskmaster.services.task_management.generation.prompt_loader import PromptLoader

PROMPT_LOADER = PromptLoader()
# TODO: Build proper agent object to abstract a lot of this functionality


def _load_prompts() -> Dict[str, str]:
    # Render jinja2 templates to strings using the prompt loader
    loader = PROMPT_LOADER
    system = loader.render("system.md", variables={})
    developer = loader.render("developer.md", variables={})
    user_template = loader.get("user_template.md").render  # rendered later with vars

    # Allowed tools remains JSON file content
    from .prompts.generate_tasks import ALLOWED_TOOL_NAMES

    return {
        "system": system,
        "developer": developer,
        "user_template_fn": user_template,  # callable
        "allowed_tools_json": json.dumps(ALLOWED_TOOL_NAMES),
    }


def _serialize_tasks(tasks: List[Task] | None) -> str:
    if not tasks:
        return "[]"
    return json.dumps([json.loads(t.model_dump_json()) for t in tasks])


def generate_tasks_with_agent(body: GenerateTasksRequest) -> GenerateTasksResponse:
    prompts = _load_prompts()
    settings = get_settings()
    client = OpenAI()

    # Render user prompt with required variables; loader checks missing/extra vars
    user_prompt = default_loader().render(
        "user_template.md",
        variables={
            "transcript": body.transcript,
            "existing_tasks_json": _serialize_tasks(body.existing_tasks),
        },
    )

    # Responses API style with multi-roles and tool allowances
    response = client.responses.create(
        model=settings.openai_model,
        reasoning={"effort": settings.openai_reasoning_effort},
        input=[
            {"role": "system", "content": prompts["system"]},
            {
                "role": "developer",
                "content": prompts["developer"]
                + "\nAllowed tools: "
                + prompts[
                    "allowed_tools_json"
                ],  # TODO: Absolutely not, we should not include tool references in the developer prompt.
            },
            {"role": "user", "content": user_prompt},
        ],
        tools=[  # TODO: How are the tools included here surfaced to the model? Can we see them in traces?
            {
                "type": "mcp",
                "server": {
                    "name": "taskmaster-mcp",
                    "command": "node",
                    "args": [settings.mcp_server_absolute_path()],
                    "env": {
                        "TASKMASTER_BASE_URL": settings.base_url,
                    },
                },
                "allowed_tools": [  # TODO: is this an actual parameter we can use?
                    "tasks.create_task_api_create_task_post",
                    "tasks.update_task_api_update_task_post",
                    "tasks.delete_task_api_delete_task_post",
                ],
            }
        ],
        tool_choice="auto",
        max_output_tokens=settings.openai_max_output_tokens,
    )

    # Extract final task list from the model's final message if provided; otherwise fallback to API listing
    final_tasks: List[Task] = []
    try:
        # The Responses API returns output messages; we scan for a JSON array in the last text
        outputs = response.output or []  # type: ignore[attr-defined]
        last_text_chunks: List[str] = []
        for item in outputs:
            if item.get("type") == "message":
                for c in item.get("content", []):
                    if c.get("type") == "output_text" and isinstance(
                        c.get("text"), str
                    ):
                        last_text_chunks.append(c.get("text"))
        final_text = "\n".join(last_text_chunks).strip()
        # Heuristic: find first JSON array in the text
        start = final_text.find("[")
        end = final_text.rfind("]")
        if start != -1 and end != -1 and end > start:
            arr = json.loads(final_text[start : end + 1])
            # Coerce into Task models; tolerate partial fields by skipping invalid entries
            for obj in arr:
                try:
                    final_tasks.append(Task.model_validate(obj))
                except Exception:
                    continue
    except Exception:
        final_tasks = []

    # If the model did not return parsed tasks, we can simply list tasks via our repo for now in the service layer.
    return GenerateTasksResponse(tasks=final_tasks)
