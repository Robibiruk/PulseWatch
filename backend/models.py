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

    # Telegram integration
    telegram_chat_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    telegram_link_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    alerts_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    last_checkin_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Alert channels (comma-separated enabled channels: telegram,email,discord,slack,webhook)
    enabled_channels: Mapped[str] = mapped_column(String(255), default="telegram,email")
    # Per-user channel targets (override global webhooks / email)
    alert_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    discord_webhook: Mapped[str | None] = mapped_column(String(512), nullable=True)
    slack_webhook: Mapped[str | None] = mapped_column(String(512), nullable=True)
    webhook_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

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
    monitor_type: Mapped[str] = mapped_column(String(16), default="http")  # http | heartbeat
    heartbeat_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    interval: Mapped[int] = mapped_column(Integer, default=60)  # seconds
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # monitoring parameters (free tier)
    tags: Mapped[str] = mapped_column(String(255), default="")  # comma-separated
    request_timeout: Mapped[int] = mapped_column(Integer, default=10)  # seconds
    ip_version: Mapped[str] = mapped_column(String(8), default="auto")  # auto | ipv4 | ipv6
    follow_redirects: Mapped[bool] = mapped_column(Boolean, default=True)
    check_ssl: Mapped[bool] = mapped_column(Boolean, default=True)  # check SSL errors
    ssl_expiry_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
    domain_expiry_reminders: Mapped[bool] = mapped_column(Boolean, default=False)
    # paid-tier options (stored but locked behind plan — Upgrade badges in UI)
    slow_response_alert: Mapped[bool] = mapped_column(Boolean, default=False)
    slow_response_threshold_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    up_status_codes: Mapped[str] = mapped_column(String(32), default="2xx,3xx")  # which codes count as up
    http_method: Mapped[str] = mapped_column(String(8), default="GET")  # GET | HEAD | POST
    auth_type: Mapped[str] = mapped_column(String(16), default="none")  # none | basic | bearer
    auth_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_pass: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_bearer: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # incident state machine
    status: Mapped[str] = mapped_column(String(16), default="up")  # up | down
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0)
    next_check: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    # Distributed-worker locking: a worker "claims" a monitor by writing a
    # unique token + a short claim window. Other instances skip claimed rows,
    # so scaling the worker horizontally (multiple Render instances) never
    # produces duplicate checks or duplicate alerts.
    claim_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    claimed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_checked: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # SSL certificate expiry (for https monitors)
    ssl_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ssl_warned: Mapped[bool] = mapped_column(Boolean, default=False)
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


class StatusPage(Base):
    __tablename__ = "status_pages"
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), default="PulseWatch Status")
    description: Mapped[str] = mapped_column(Text, default="")
    theme: Mapped[str] = mapped_column(String(16), default="neon")  # neon | light | minimal
    show_response_time: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApiToken(Base):
    __tablename__ = "api_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), default="token")
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    preview: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped["User"] = relationship(back_populates="tokens")


User.tokens = relationship("ApiToken", back_populates="owner", cascade="all, delete-orphan")

