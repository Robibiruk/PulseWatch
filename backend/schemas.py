from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, ConfigDict, computed_field


# ── Auth ──
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = ""


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str
    is_active: bool
    created_at: datetime
    plan: str = "free"
    trial_ends_at: datetime | None = None
    alerts_paused: bool = False
    telegram_chat_id: str | None = None
    enabled_channels: str = "telegram,email"
    alert_email: str | None = None
    discord_webhook: str | None = None
    slack_webhook: str | None = None
    webhook_url: str | None = None

    @computed_field
    @property
    def telegram_linked(self) -> bool:
        return bool(self.telegram_chat_id)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Monitor ──
class MonitorCreate(BaseModel):
    name: str
    url: str | None = None
    interval: int = Field(default=60, ge=30, le=3600)
    monitor_type: str = "http"
    tags: str = ""
    request_timeout: int = Field(default=10, ge=1, le=60)
    ip_version: str = "auto"
    follow_redirects: bool = True
    check_ssl: bool = True
    ssl_expiry_reminders: bool = True
    domain_expiry_reminders: bool = False
    http_method: str = "GET"
    auth_type: str = "none"
    auth_user: str | None = None
    auth_pass: str | None = None
    auth_bearer: str | None = None
    up_status_codes: str = "2xx,3xx"


class MonitorUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    interval: int | None = None
    enabled: bool | None = None
    tags: str | None = None
    request_timeout: int | None = None
    ip_version: str | None = None
    follow_redirects: bool | None = None
    check_ssl: bool | None = None
    ssl_expiry_reminders: bool | None = None
    domain_expiry_reminders: bool | None = None
    slow_response_alert: bool | None = None
    slow_response_threshold_ms: int | None = None
    up_status_codes: str | None = None
    http_method: str | None = None
    auth_type: str | None = None
    auth_user: str | None = None
    auth_pass: str | None = None
    auth_bearer: str | None = None


class CheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    status_code: int | None
    response_time: float | None
    error: str | None
    checked_at: datetime


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    started_at: datetime
    resolved_at: datetime | None
    reason: str | None
    status_code: int | None
    ai_explanation: str | None
    recovery_minutes: float | None


class MonitorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int
    name: str
    url: str
    monitor_type: str = "http"
    interval: int
    enabled: bool
    status: str
    consecutive_failures: int
    next_check: datetime
    last_checked: datetime | None
    last_heartbeat: datetime | None = None
    ssl_expires_at: datetime | None = None
    created_at: datetime
    # monitoring parameters (free + stored paid options)
    tags: str = ""
    request_timeout: int = 10
    ip_version: str = "auto"
    follow_redirects: bool = True
    check_ssl: bool = True
    ssl_expiry_reminders: bool = True
    domain_expiry_reminders: bool = False
    slow_response_alert: bool = False
    slow_response_threshold_ms: int | None = None
    up_status_codes: str = "2xx,3xx"
    http_method: str = "GET"
    auth_type: str = "none"
    uptime_24h: float | None = None
    avg_response_time: float | None = None


class MonitorDetail(MonitorOut):
    recent_checks: list[CheckOut] = []
    recent_incidents: list[IncidentOut] = []


# ── Fleet summary (dashboard KPIs) ──
class IncidentOutShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    monitor_id: int
    monitor_name: str | None = None
    started_at: datetime
    resolved_at: datetime | None
    reason: str | None
    status_code: int | None
    recovery_minutes: float | None


class FleetSummary(BaseModel):
    total: int
    up: int
    down: int
    paused: int
    active_incidents: int
    avg_response: float | None
    uptime_24h: float | None
    last_check: str | None = None


# ── Public status page ──
class PublicService(BaseModel):
    name: str
    url: str
    status: str  # up | down | paused
    uptime_24h: float
    avg_response_time: float | None
    spark: list[str] = []  # last checks: "up" | "down"


# ── Status-page builder ──
class StatusPageUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    theme: str | None = None
    show_response_time: bool | None = None


class StatusPageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    owner_id: int
    title: str
    description: str
    theme: str
    show_response_time: bool
