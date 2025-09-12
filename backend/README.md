Backend server for Taskmaster

## Setup

- Dependencies are managed with `uv`. No system Python required [[memory:7857772]].

```bash
cd backend
uv sync
```

## Database: PostgreSQL

You need a running Postgres 16+.

### Quick init (macOS/Homebrew)

```bash
./scripts/db_setup.sh
```

This will:
- Install/start Postgres (Homebrew) if needed
- Create the `taskmaster` role and database
- Write `backend/.env` with `TASKMASTER_DATABASE_URL` and `TASKMASTER_ALEMBIC_DATABASE_URL`
- Apply Alembic migrations

### Manual steps (alternative)

```bash
# Install and start (first time only)
brew install postgresql@16
brew services start postgresql@16

# Ensure psql is on PATH for this shell
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Create role and database (idempotent)
psql -d postgres -c 'DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '"'"'taskmaster'"'"') THEN CREATE ROLE taskmaster LOGIN PASSWORD '"'"'taskmaster'"'"'; END IF; END $$;'
psql -d postgres -c "ALTER ROLE taskmaster CREATEDB;"
createdb -O taskmaster taskmaster || true
psql -d postgres -c "ALTER DATABASE taskmaster OWNER TO taskmaster;"

# Create backend/.env with URLs
cat > backend/.env <<EOF
TASKMASTER_DATABASE_URL="postgresql+psycopg://taskmaster:taskmaster@localhost:5432/taskmaster"
TASKMASTER_ALEMBIC_DATABASE_URL="postgresql+psycopg://taskmaster:taskmaster@localhost:5432/taskmaster"
EOF

# Apply migrations
cd backend
uv run alembic upgrade head
```

## Run the server

```bash
cd backend
uv run uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

## Troubleshooting

- Connection refused: ensure Postgres is running (`brew services list`).
- Enum/type exists: If you hand-applied objects before migrations, drop conflicting types/tables or reset DB, then re-run `alembic upgrade head`.
- Missing deps: re-run `uv sync`.