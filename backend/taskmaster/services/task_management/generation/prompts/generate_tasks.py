from openai import OpenAI
import json
import os

_DIR = os.path.dirname(__file__)

with open(os.path.join(_DIR, "system.md"), "r", encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read()

with open(os.path.join(_DIR, "developer.md"), "r", encoding="utf-8") as f:
    DEVELOPER_PROMPT = f.read()

with open(os.path.join(_DIR, "user_template.md"), "r", encoding="utf-8") as f:
    USER_PROMPT_TEMPLATE = f.read()

with open(os.path.join(_DIR, "allowed_tools.json"), "r", encoding="utf-8") as f:
    ALLOWED_TOOL_NAMES = json.load(f)
