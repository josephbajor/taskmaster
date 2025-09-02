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
