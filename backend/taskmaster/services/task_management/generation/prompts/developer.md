Implementation guidance:
- Use multi-turn reasoning to decide the minimal set of operations.
- Validate assumptions against existing tasks before acting. Prefer updates over deletes when titles match but details changed.
- Map transcript cues: decisions, owners (ignore owners if not in schema), deadlines, priorities, statuses, and dependencies.
- If deadlines are referenced relative to today, do not guess exact dates; skip deadline unless the transcript provides a specific date/time.
- Status mapping: if unclear, default to NOT_STARTED.
- Duration: estimate conservatively in minutes if explicitly stated; otherwise default to 0.
- Follow the tool budget: first analyze, then propose plan, then execute tool calls.
- Stop after achieving ~70% confidence convergence and provide the final list.

