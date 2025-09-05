#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ELECTRON_DIR="$REPO_ROOT/electron"

chmod +x "$SCRIPT_DIR/build.sh" || true

echo "[taskmaster] Generating SDKs with Fern (local output)"

pushd "$REPO_ROOT/fern" >/dev/null
if command -v fern >/dev/null 2>&1; then
	echo "[taskmaster] fern generate (ts-sdk)"
	fern generate --group ts-sdk --log-level info | cat
	echo "[taskmaster] fern generate (python-server)"
	fern generate --group python-server --log-level info | cat
else
	if command -v npx >/dev/null 2>&1; then
		echo "[taskmaster] npx fern-api generate (ts-sdk)"
		if ! npx --yes fern-api generate --group ts-sdk --log-level info | cat; then
			echo "[taskmaster] fallback: @fern-api/cli (ts-sdk)"
			npx --yes --package @fern-api/cli fern generate --group ts-sdk --log-level info | cat
		fi
		echo "[taskmaster] npx fern-api generate (python-server)"
		if ! npx --yes fern-api generate --group python-server --log-level info | cat; then
			echo "[taskmaster] fallback: @fern-api/cli (python-server)"
			npx --yes --package @fern-api/cli fern generate --group python-server --log-level info | cat
		fi
	else
		echo "Error: Neither 'fern' nor 'npx' is available to run generation." >&2
		exit 1
	fi
fi
popd >/dev/null

# Ensure TypeScript is available for SDK build
pushd "$ELECTRON_DIR" >/dev/null
if ! ./node_modules/.bin/tsc -v >/dev/null 2>&1; then
	echo "[taskmaster] Installing TypeScript (devDependency) for SDK build"
	npm install --save-dev typescript
fi
popd >/dev/null

# Build generated TypeScript SDK for runtime (outputs .js next to .ts)
echo "[taskmaster] Building TypeScript SDK"
pushd "$ELECTRON_DIR" >/dev/null
npm run --silent build:sdk || echo "[taskmaster] Warning: SDK build failed; ensure TypeScript is installed and try again."
popd >/dev/null


echo "[taskmaster] Done. SDKs should be available under electron/src/sdk and backend/taskmaster/api"


# Export OpenAPI spec from FastAPI app (prefers uv) for downstream generators (e.g., MCP)
echo "[taskmaster] Exporting OpenAPI spec"
if command -v uv >/dev/null 2>&1; then
	uv run --directory "$REPO_ROOT/backend" python scripts/export_openapi.py | cat
else
	echo "[taskmaster] 'uv' not found; attempting system python for OpenAPI export"
	PYTHONPATH="$REPO_ROOT/backend:$PYTHONPATH" python "$REPO_ROOT/backend/scripts/export_openapi.py" | cat || \
	  echo "[taskmaster] Warning: OpenAPI export failed; ensure uv or python is installed."
fi

# Generate MCP server (Node-based) from OpenAPI for tasks endpoints
echo "[taskmaster] Generating MCP server from OpenAPI"
node "$REPO_ROOT/mcp/generate_server.js" | cat || echo "[taskmaster] Warning: MCP generation failed"

