# Taskmaster

Taskmaster is a planner app designed around automatic prioritization and task creation from unstructured text. This repo is structured to enable independent development of the Electron frontend and Python backend, with an API defined via Fern (Fern Definition) for generated SDKs.

## Project structure

```
taskmaster/
├── electron/            # Electron desktop UI (self-contained NPM project)
├── backend/             # Python backend (uv-managed FastAPI app)
├── shared/              # Shared assets/configs
├── fern/                # Fern Definition + generators
└── scripts/             # Dev/build helpers
```

## Prerequisites

- Node.js 18+ and npm
- `uv` package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`) — manages Python for you
- OpenAI API key (`OPENAI_API_KEY`)
- PostgreSQL 16+ (for backend task management)

## One-command dev

```
./scripts/dev.sh
```

This will:
- Sync backend deps with `uv sync`
- Generate SDKs with Fern
- Start the FastAPI backend on http://127.0.0.1:8000
- Start the Electron app

Note: Scripts auto-detect a system `fern` CLI (e.g., via Homebrew) and use it when available; otherwise they fallback to an npx-based CLI.

If `OPENAI_API_KEY` is not set, you’ll see a warning and transcription requests will fail until you export it.

## Database initialization (Postgres)

Quick start on macOS (Homebrew):

```
brew install postgresql@16
brew services start postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
psql -d postgres -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taskmaster') THEN CREATE ROLE taskmaster LOGIN PASSWORD 'taskmaster'; END IF; END $$;"
psql -d postgres -c "ALTER ROLE taskmaster CREATEDB;"
createdb -O taskmaster taskmaster || true
psql -d postgres -c "ALTER DATABASE taskmaster OWNER TO taskmaster;"
```

Environment variables:

```
# Runtime (backend)
export DATABASE_URL="postgresql+psycopg://taskmaster:taskmaster@localhost:5432/taskmaster"
# Alembic (migrations)
export ALEMBIC_DATABASE_URL="postgresql+psycopg://taskmaster:taskmaster@localhost:5432/taskmaster"
```

Apply migrations:

```
cd backend
uv run alembic upgrade head
```

For detailed backend setup and troubleshooting, see `backend/README.md`.

## Running the backend (manual)

```
cd backend
uv sync
export OPENAI_API_KEY=YOUR_KEY
uv run uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

- Health check: `GET http://127.0.0.1:8000/api/health`
- Transcription: `POST http://127.0.0.1:8000/api/transcriptions` with `multipart/form-data` field `file`

## API definition & SDKs (Fern)

We use a Fern Definition rather than OpenAPI.

- Definition files under `fern/definition/`:
  - `api.yml`: API-level config and environments
  - `taskmaster.yml`: endpoints and types
- Generators: `fern/generators.yml`

Generate SDKs locally:

```
./scripts/build.sh
```

Refer to Fern’s Fern Definition overview for structure and examples ([Fern Definition overview](https://buildwithfern.com/learn/api-definitions/ferndef/overview)).

## Notes

- Electron and Python can be run independently for faster iteration.
- Ensure `OPENAI_API_KEY` is set for backend transcription.
- This is a minimal MVP wiring. Error handling and streaming UX can be enhanced later.

## Backend debugging (breakpoints)

You can launch the backend with `debugpy` so you can attach a debugger (VS Code, PyCharm, etc.). The dev script wires this up using `uv` so no global Python packages are required.

### Quick start

Start dev with backend debugging enabled:

```
./scripts/dev.sh --backend-debug
```

Options:

- `--backend-debug-port <port>`: Debugger port (default: 5678)
- `--backend-debug-wait`: Make the server wait for the debugger to attach before serving
- `--no-electron`: Skip launching the Electron app (useful when only debugging backend)

Under the hood, this sets the following env vars read by `backend/server.py`:

- `BACKEND_DEBUG=1`
- `BACKEND_DEBUG_PORT` (default `5678`)
- `BACKEND_DEBUG_WAIT=1` when `--backend-debug-wait` is used

The backend is started via `uv run --with debugpy` to install and load `debugpy` in an ephemeral, project-local environment.

### Attach from VS Code

Add a launch config like:

```json
{
  "name": "Attach to Taskmaster backend",
  "type": "python",
  "request": "attach",
  "connect": { "host": "127.0.0.1", "port": 5678 },
  "justMyCode": true
}
```

Then run `./scripts/dev.sh --backend-debug --no-electron` (optional) and attach.

### Attach from PyCharm

Run > Edit Configurations… > Add New > Python Debug Server

- Port: 5678
- Host: 127.0.0.1

Start `./scripts/dev.sh --backend-debug` and then click the debug config to attach.
