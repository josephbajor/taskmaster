#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

chmod +x "$SCRIPT_DIR/build.sh" || true

echo "[taskmaster] Generating SDKs with Fern (local output)"

pushd "$REPO_ROOT/fern" >/dev/null
if command -v fern >/dev/null 2>&1; then
	fern generate --log-level info | cat
else
	if command -v npx >/dev/null 2>&1; then
		if npx --yes fern-api generate --log-level info | cat; then
			:
		elif npx --yes --package @fern-api/cli fern generate --log-level info | cat; then
			:
		else
			echo "Error: Fern generation failed. Install fern (brew install fern-api/tap/fern) or ensure npx is available." >&2
			exit 1
		fi
	else
		echo "Error: Neither 'fern' nor 'npx' is available to run generation." >&2
		exit 1
	fi
fi
popd >/dev/null

echo "[taskmaster] Done. SDKs should be available under electron/src/sdk and backend/taskmaster/sdk"

