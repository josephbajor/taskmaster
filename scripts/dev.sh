#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$REPO_ROOT/backend"
ELECTRON_DIR="$REPO_ROOT/electron"
MCP_DIR="$REPO_ROOT/mcp/taskmaster-server"

# Args / flags (defaults)
BACKEND_DEBUG=0
BACKEND_DEBUG_PORT=5678
BACKEND_DEBUG_WAIT=0
START_ELECTRON=1

while [[ $# -gt 0 ]]; do
	case "$1" in
		--backend-debug)
			BACKEND_DEBUG=1
			shift
			;;
		--backend-debug-port)
			BACKEND_DEBUG_PORT="$2"
			shift 2
			;;
		--backend-debug-wait)
			BACKEND_DEBUG_WAIT=1
			shift
			;;
		--no-electron)
			START_ELECTRON=0
			shift
			;;
		*)
			echo "Unknown argument: $1" >&2
			exit 1
			;;
	esac
done

# Ensure we cleanup children on exit
cleanup() {
	if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
		echo "[dev] Stopping backend ($BACKEND_PID)"
		kill "$BACKEND_PID" || true
		wait "$BACKEND_PID" 2>/dev/null || true
	fi
	if [[ -n "${MCP_PID:-}" ]] && kill -0 "$MCP_PID" >/dev/null 2>&1; then
		echo "[dev] Stopping MCP server ($MCP_PID)"
		kill "$MCP_PID" || true
		wait "$MCP_PID" 2>/dev/null || true
	fi
}
trap cleanup EXIT INT TERM

# Checks
command -v uv >/dev/null 2>&1 || { echo "Error: 'uv' is required. See https://astral.sh/uv" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm is required" >&2; exit 1; }

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
	echo "Warning: OPENAI_API_KEY is not set. Backend transcription will fail until it is set." >&2
fi

# Backend deps
echo "[dev] Syncing backend dependencies (uv)"
pushd "$BACKEND_DIR" >/dev/null
uv sync
popd >/dev/null

# Generated components presence check (generation handled by scripts/build.sh)
if [[ ! -d "$ELECTRON_DIR/src/sdk" || ! -d "$BACKEND_DIR/taskmaster/api" ]]; then
	echo "[dev] Generated API/SDK not found. Run '$SCRIPT_DIR/build.sh' to generate with Fern." >&2
fi

# Ensure MCP server is generated
if [[ ! -d "$MCP_DIR" ]]; then
	echo "[dev] MCP server not found. Running build to generate it."
	bash "$SCRIPT_DIR/build.sh"
fi

# Electron deps
echo "[dev] Installing Electron dependencies"
pushd "$ELECTRON_DIR" >/dev/null
if [[ -f package-lock.json ]]; then
    npm ci
else
    echo "[dev] Creating package-lock.json"
    if npm install --package-lock-only; then
        npm ci
    else
        echo "[dev] npm install --package-lock-only unsupported; running npm install"
        npm install
    fi
fi
popd >/dev/null

# Start backend
pushd "$BACKEND_DIR" >/dev/null
if [[ "$BACKEND_DEBUG" == "1" ]]; then
	echo "[dev] Starting backend with debugpy (port $BACKEND_DEBUG_PORT) at http://127.0.0.1:8000"
	BACKEND_DEBUG=1 BACKEND_DEBUG_PORT="$BACKEND_DEBUG_PORT" BACKEND_DEBUG_WAIT="$BACKEND_DEBUG_WAIT" \
		uv run --with debugpy uvicorn server:app --host 127.0.0.1 --port 8000 --log-level debug &
else
	echo "[dev] Starting backend at http://127.0.0.1:8000 (reload, debug logging)"
	uv run uvicorn server:app --host 127.0.0.1 --port 8000 --reload --log-level debug &
fi
BACKEND_PID=$!
popd >/dev/null

# Small wait for backend to boot
sleep 1

# Start MCP server (stdio) pointing at backend
if [[ -d "$MCP_DIR" ]]; then
	pushd "$MCP_DIR" >/dev/null
	echo "[dev] Installing MCP server dependencies"
	npm install
	echo "[dev] Starting MCP server (stdio)"
	TASKMASTER_BASE_URL="http://127.0.0.1:8000" npm start &
	MCP_PID=$!
	popd >/dev/null
else
	echo "[dev] Skipping MCP server startup; directory missing: $MCP_DIR" >&2
fi

# Start Electron (foreground)
if [[ "$START_ELECTRON" == "1" ]]; then
	echo "[dev] Starting Electron app"
	pushd "$ELECTRON_DIR" >/dev/null
	npm run dev
	popd >/dev/null
else
	echo "[dev] Skipping Electron launch (--no-electron)"
fi
