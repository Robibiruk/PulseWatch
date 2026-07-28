from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import inspect, event

from config import settings

engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, conn_record):
    """Enable WAL + a busy timeout so SQLite survives the worker's concurrency
    (avoids 'database is locked' on dev/CI). No-op for Postgres."""
    if "sqlite" in settings.database_url:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


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


def _create_table_if_missing(connection, model) -> None:
    """Create a table only if it does not already exist (idempotent)."""
    from sqlalchemy import inspect as _inspect

    tables = _inspect(connection).get_table_names()
    if model.__tablename__ not in tables:
        model.__table__.create(connection, checkfirst=True)


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
    # User: telegram linkage + pause flag
    user_cols = [
        ("telegram_chat_id", "VARCHAR(64)"),
        ("telegram_link_token", "VARCHAR(64)"),
        ("alerts_paused", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("enabled_channels", "VARCHAR(255) NOT NULL DEFAULT 'telegram,email'"),
        ("alert_email", "VARCHAR(255)"),
        ("discord_webhook", "VARCHAR(512)"),
        ("slack_webhook", "VARCHAR(512)"),
        ("webhook_url", "VARCHAR(512)"),
        ("last_checkin_at", "TIMESTAMP"),
        ("status_slug", "VARCHAR(64)"),
    ]
    for col, coltype in user_cols:
        await conn.run_sync(_add_missing, "users", col, coltype)

    # Monitor: heartbeat + ssl tracking
    monitor_cols = [
        ("monitor_type", "VARCHAR(16) NOT NULL DEFAULT 'http'"),
        ("heartbeat_token", "VARCHAR(64)"),
        ("last_heartbeat", "TIMESTAMP"),
        ("ssl_expires_at", "TIMESTAMP"),
        ("ssl_warned", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("tags", "VARCHAR(255) NOT NULL DEFAULT ''"),
        ("request_timeout", "INTEGER NOT NULL DEFAULT 10"),
        ("ip_version", "VARCHAR(8) NOT NULL DEFAULT 'auto'"),
        ("follow_redirects", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("check_ssl", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("ssl_expiry_reminders", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("domain_expiry_reminders", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("slow_response_alert", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("slow_response_threshold_ms", "INTEGER"),
        ("up_status_codes", "VARCHAR(32) NOT NULL DEFAULT '2xx,3xx'"),
        ("http_method", "VARCHAR(8) NOT NULL DEFAULT 'GET'"),
        ("auth_type", "VARCHAR(16) NOT NULL DEFAULT 'none'"),
        ("auth_user", "VARCHAR(255)"),
        ("auth_pass", "VARCHAR(255)"),
        ("auth_bearer", "VARCHAR(512)"),
        ("claimed_until", "TIMESTAMP"),
        ("claim_token", "VARCHAR(64)"),
    ]
    for col, coltype in monitor_cols:
        await conn.run_sync(_add_missing, "monitors", col, coltype)

    # StatusPage config
    from models import StatusPage, ApiToken
    await conn.run_sync(_create_table_if_missing, StatusPage)
    await conn.run_sync(_create_table_if_missing, ApiToken)

