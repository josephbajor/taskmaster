from __future__ import annotations

from typing import Generator, Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from taskmaster.config import get_settings


def _get_database_url() -> str:
    settings = get_settings()
    return settings.get_database_url()


_engine = None  # type: ignore[var-annotated]
_SessionLocal: Optional[sessionmaker] = None


def _get_engine():
    global _engine  # noqa: PLW0603
    if _engine is None:
        _engine = create_engine(
            _get_database_url(), echo=False, pool_pre_ping=True, future=True
        )
    return _engine


def _get_session_local() -> sessionmaker:
    global _SessionLocal  # noqa: PLW0603
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=_get_engine(),
            class_=Session,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )
    return _SessionLocal


def get_db_session() -> Generator[Session, None, None]:
    SessionLocal = _get_session_local()
    with SessionLocal() as session:
        yield session
