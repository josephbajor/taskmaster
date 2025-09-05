#!/usr/bin/env python3
import json
import os
import sys


def main() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    # Ensure backend is importable
    backend_path = os.path.join(repo_root, "backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    try:
        # Import the FastAPI app from backend/server.py
        from server import app  # type: ignore
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"[export-openapi] Failed to import FastAPI app: {exc}\n")
        return 1

    try:
        spec = app.openapi()  # type: ignore[attr-defined]
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"[export-openapi] Failed to generate OpenAPI spec: {exc}\n")
        return 1

    out_dir = os.path.join(repo_root, "shared")
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "openapi.json")

    try:
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(spec, f, indent=2, ensure_ascii=False)
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"[export-openapi] Failed to write OpenAPI spec: {exc}\n")
        return 1

    print(f"[export-openapi] Wrote OpenAPI spec to {out_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
