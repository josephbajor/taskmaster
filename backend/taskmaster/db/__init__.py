from taskmaster.db.base import Base

# Import models so Alembic autogenerate can discover them via Base.metadata
from taskmaster.db.models.task import TaskRow as _TaskRow  # noqa: F401
