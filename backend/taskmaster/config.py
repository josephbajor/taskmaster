from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TASKMASTER_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Absolute path to the monorepo/workspace root (e.g., /Users/.../taskmaster)
    workspace_root: Optional[str] = Field(
        default=None, description="Absolute path to the Taskmaster workspace root"
    )

    # Relative path (from workspace_root) to the MCP server .mjs entrypoint
    mcp_server_relative_path: str = Field(
        default="mcp/taskmaster-server/server.mjs",
        description="Relative path from workspace_root to MCP server entrypoint",
    )

    # Backend base URL used by MCP server to call the HTTP API
    base_url: str = Field(default="http://127.0.0.1:8000", alias="BASE_URL")

    # OpenAI settings
    openai_model: str = Field(default="gpt-5.1", alias="OPENAI_MODEL")
    openai_reasoning_effort: str = Field(
        default="high", alias="OPENAI_REASONING_EFFORT"
    )
    openai_max_output_tokens: int = Field(
        default=2000, alias="OPENAI_MAX_OUTPUT_TOKENS"
    )

    def mcp_server_absolute_path(self) -> str:
        if not self.workspace_root:
            raise RuntimeError(
                "TASKMASTER_WORKSPACE_ROOT must be set (absolute path to repo root)"
            )
        return str(Path(self.workspace_root) / self.mcp_server_relative_path)


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
