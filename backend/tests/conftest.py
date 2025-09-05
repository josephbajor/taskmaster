import os
import tempfile
import contextlib
import pytest
from typing import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from taskmaster.db.base import Base
from taskmaster.db.models.task import TaskRow  # ensure models import
from taskmaster.db.session import get_db_session
from taskmaster.api.register import register as register_fern
from taskmaster.services.system.core import SystemService
from taskmaster.services.task_management.core import TasksService
from taskmaster.services.transcription.core import TranscriptionService
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture(scope="session", autouse=True)
def _ensure_urls() -> None:
    # Prefer a dedicated test database
    sync_url = os.getenv(
        "ALEMBIC_DATABASE_URL",
        "postgresql+psycopg://taskmaster:taskmaster@localhost:5432/taskmaster",
    )
    os.environ.setdefault("DATABASE_URL", sync_url.replace("+psycopg", "+asyncpg"))
    os.environ.setdefault("ALEMBIC_DATABASE_URL", sync_url)


@pytest.fixture(scope="session")
def _apply_migrations(_ensure_urls: None) -> None:
    # Use alembic via CLI to ensure the schema is at head for tests
    # This relies on the test machine having the DB running (as in README)
    os.system("uv run alembic upgrade head > /dev/null 2>&1")


@pytest.fixture()
def db_session(_apply_migrations: None) -> Iterator[Session]:
    # Provide a clean transactional scope per test
    sync_url = os.environ["ALEMBIC_DATABASE_URL"]
    engine = create_engine(sync_url, future=True)
    connection = engine.connect()
    # Ensure a clean state for each test without taking heavy ACCESS EXCLUSIVE locks
    # that TRUNCATE would require (which can hang if another session holds locks).
    # We perform a quick cleanup transaction prior to the test transaction.
    try:
        cleanup_trans = connection.begin()
        connection.exec_driver_sql("DELETE FROM task_prerequisites")
        connection.exec_driver_sql("DELETE FROM tasks")
        cleanup_trans.commit()
    except Exception:
        # Best-effort cleanup; continue even if deletion fails. The nested
        # transaction below still provides isolation for the test run itself.
        try:
            cleanup_trans.rollback()  # type: ignore[has-type]
        except Exception:
            pass
    trans = connection.begin()
    TestingSessionLocal = sessionmaker(
        bind=connection, class_=Session, expire_on_commit=False
    )
    session = TestingSessionLocal()

    # Start a SAVEPOINT so that even if code calls commit(), we can rollback
    nested = session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, transaction):  # type: ignore[no-redef]
        if transaction.nested and not transaction._parent.nested:  # type: ignore[attr-defined]
            sess.begin_nested()

    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        connection.close()


@pytest.fixture()
def app(db_session: Session) -> FastAPI:
    # Build a FastAPI app instance and override DB dep to use the test session
    def _override_get_db_session() -> Iterator[Session]:
        yield db_session

    application = FastAPI()
    register_fern(
        application,
        system=SystemService(),
        tasks=TasksService(),
        transcription=TranscriptionService(),
    )
    # Override dependency for TasksService init
    application.dependency_overrides[get_db_session] = _override_get_db_session
    return application


@pytest.fixture()
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c
