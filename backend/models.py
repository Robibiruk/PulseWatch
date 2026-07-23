from datetime import datetime, timezone

from sqlalchemy import (
    String, Integer, Boolean, DateTime, Float, Text, ForeignKey, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    monitors: Mapped[list["Monitor"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Monitor(Base):
    __tablename__ = "monitors"
    __table_args__ = (Index("ix_monitor_owner_next", "owner_id", "next_check"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(2048))
    interval: Mapped[int] = mapped_column(Integer, default=60)  # seconds
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # incident state machine
    status: Mapped[str] = mapped_column(String(16), default="up")  # up | down
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0)
    next_check: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_checked: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped["User"] = relationship(back_populates="monitors")
    checks: Mapped[list["Check"]] = relationship(
        back_populates="monitor", cascade="all, delete-orphan", order_by="Check.checked_at.desc()"
    )
    incidents: Mapped[list["Incident"]] = relationship(
        back_populates="monitor", cascade="all, delete-orphan", order_by="Incident.started_at.desc()",
        foreign_keys="[Incident.monitor_id]",
    )


class Check(Base):
    __tablename__ = "checks"

    id: Mapped[int] = mapped_column(primary_key=True)
    monitor_id: Mapped[int] = mapped_column(ForeignKey("monitors.id"))
    status: Mapped[str] = mapped_column(String(16))  # up | down
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_time: Mapped[float | None] = mapped_column(Float, nullable=True)  # ms
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    monitor: Mapped["Monitor"] = relationship(back_populates="checks")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    monitor_id: Mapped[int] = mapped_column(ForeignKey("monitors.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)  # last error
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ai_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    recovery_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)

    monitor: Mapped["Monitor"] = relationship(
        back_populates="incidents", foreign_keys="[Incident.monitor_id]"
    )
