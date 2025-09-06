Transcript:
{transcript}

Existing tasks (JSON):
{existing_tasks_json}

Task schemas:
- CreateTaskRequest: { title, description, status, priority, duration_seconds, deadline?, prerequisite_tasks? }
- UpdateTaskRequest: { title, description?, status?, priority?, duration_seconds?, deadline?, prerequisite_tasks? }
- DeleteTaskRequest: { title }

Instructions:
1) Think step-by-step about which tasks to add, update, or delete.
2) Use only the tools provided to perform changes.
3) When done, return the final task list summary as a JSON array of Task objects.

