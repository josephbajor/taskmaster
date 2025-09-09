from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

from jinja2 import Environment, FileSystemLoader, Template, meta


_LOGGER = logging.getLogger(__name__)


class PromptLoader:
    def __init__(self, templates_dir: Optional[str] = None) -> None:
        base_dir = templates_dir or os.path.join(os.path.dirname(__file__), "prompts")
        self._env = Environment(
            loader=FileSystemLoader(base_dir),
            autoescape=False,
            keep_trailing_newline=True,
            # Default undefined: do not raise; we'll log missing ourselves
            trim_blocks=False,
            lstrip_blocks=False,
        )

    def get(self, filename: str) -> Template:
        return self._env.get_template(filename)

    def render(
        self, filename: str, *, variables: Optional[Dict[str, Any]] = None
    ) -> str:
        # Parse template source to determine referenced variables
        source, _, _ = self._env.loader.get_source(self._env, filename)
        ast = self._env.parse(source)
        referenced = set(meta.find_undeclared_variables(ast))
        # Exclude env globals (builtins/macros) from expected set
        referenced -= set(self._env.globals.keys())

        provided_keys = set(variables.keys()) if variables else set()
        missing_keys = referenced - provided_keys
        if missing_keys:
            _LOGGER.warning(
                "Prompt '%s' missing variables: %s", filename, sorted(missing_keys)
            )

        extra_keys = provided_keys - referenced
        if extra_keys:
            raise ValueError(
                f"Unexpected template variables provided: {sorted(extra_keys)}"
            )

        template = self.get(filename)
        return template.render(**(variables or {}))
