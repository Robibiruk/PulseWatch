from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import inspect, text

from config import settings

engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    # Import models so they register on Base.metadata before create_all
    import models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # create_all won't add columns to an existing table, so migrate them
        await _migrate_columns(conn)


async def _migrate_columns(conn) -> None:
    """Add new columns to existing tables without dropping data.

    Uses DB-agnostic, idempotent ALTERs guarded by inspection so it works on
    both SQLite (dev) and Postgres (prod).
    """
    from sqlalchemy import inspect

    def _add_missing(connection, table: str, col: str, coltype: str) -> None:
        existing = [c["name"] for c in inspect(connection).get_columns(table)]
        if col not in existing:
            connection.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}")

    for col, coltype in (
        ("telegram_chat_id", "VARCHAR(64)"),
        ("telegram_link_token", "VARCHAR(64)"),
        ("alerts_paused", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ):
        await conn.run_sync(_add_missing, "users", col, coltype)

