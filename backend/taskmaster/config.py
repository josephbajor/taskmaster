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
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")

    # Database settings
    database_url: Optional[str] = Field(default=None, alias="DATABASE_URL")
    alembic_database_url: Optional[str] = Field(
        default=None, alias="ALEMBIC_DATABASE_URL"
    )

    # Debugger settings (for local development)
    backend_debug: bool = Field(default=False, alias="BACKEND_DEBUG")
    backend_debug_wait: bool = Field(default=False, alias="BACKEND_DEBUG_WAIT")
    backend_debug_host: str = Field(default="127.0.0.1", alias="BACKEND_DEBUG_HOST")
    backend_debug_port: int = Field(default=5678, alias="BACKEND_DEBUG_PORT")

    def mcp_server_absolute_path(self) -> str:
        if not self.workspace_root:
            raise RuntimeError(
                "TASKMASTER_WORKSPACE_ROOT must be set (absolute path to repo root)"
            )
        return str(Path(self.workspace_root) / self.mcp_server_relative_path)

    def get_database_url(self) -> str:
        if not self.database_url:
            raise RuntimeError("DATABASE_URL must be set in configuration")
        return self.database_url

    def get_alembic_database_url(self) -> str:
        url = self.alembic_database_url or self.database_url
        if not url:
            raise RuntimeError(
                "ALEMBIC_DATABASE_URL or DATABASE_URL must be set in configuration"
            )
        return url


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
