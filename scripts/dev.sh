#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$REPO_ROOT/backend"
ELECTRON_DIR="$REPO_ROOT/electron"

# Ensure we cleanup children on exit
cleanup() {
	if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
		echo "[dev] Stopping backend ($BACKEND_PID)"
		kill "$BACKEND_PID" || true
		wait "$BACKEND_PID" 2>/dev/null || true
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

# Electron deps
if [[ ! -d "$ELECTRON_DIR/node_modules" ]]; then
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
fi

# Start backend
echo "[dev] Starting backend at http://127.0.0.1:8000 (debug logging)"
pushd "$BACKEND_DIR" >/dev/null
uv run uvicorn server:app --host 127.0.0.1 --port 8000 --reload --log-level debug &
BACKEND_PID=$!
popd >/dev/null

# Small wait for backend to boot
sleep 1

# Start Electron (foreground)
echo "[dev] Starting Electron app"
pushd "$ELECTRON_DIR" >/dev/null
npm run dev
popd >/dev/null
