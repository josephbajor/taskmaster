#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

chmod +x "$SCRIPT_DIR/build.sh" || true

echo "[taskmaster] Generating SDKs with Fern (local output)"

pushd "$REPO_ROOT/fern" >/dev/null
if command -v fern >/dev/null 2>&1; then
	echo "[taskmaster] fern generate (ts-sdk)"
	fern generate --group ts-sdk --log-level info | cat
	echo "[taskmaster] fern generate (python-sdk)"
	fern generate --group python-sdk --log-level info | cat
else
	if command -v npx >/dev/null 2>&1; then
		echo "[taskmaster] npx fern-api generate (ts-sdk)"
		if ! npx --yes fern-api generate --group ts-sdk --log-level info | cat; then
			echo "[taskmaster] fallback: @fern-api/cli (ts-sdk)"
			npx --yes --package @fern-api/cli fern generate --group ts-sdk --log-level info | cat
		fi
		echo "[taskmaster] npx fern-api generate (python-sdk)"
		if ! npx --yes fern-api generate --group python-sdk --log-level info | cat; then
			echo "[taskmaster] fallback: @fern-api/cli (python-sdk)"
			npx --yes --package @fern-api/cli fern generate --group python-sdk --log-level info | cat
		fi
	else
		echo "Error: Neither 'fern' nor 'npx' is available to run generation." >&2
		exit 1
	fi
fi
popd >/dev/null

echo "[taskmaster] Done. SDKs should be available under electron/src/sdk and backend/taskmaster/sdk"

