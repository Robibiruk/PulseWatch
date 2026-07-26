from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict, computed_field


# ── Auth ──
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str
    is_active: bool
    created_at: datetime
    alerts_paused: bool = False
    telegram_chat_id: str | None = None

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
    url: str
    interval: int = 60


class MonitorUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    interval: int | None = None
    enabled: bool | None = None


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
    interval: int
    enabled: bool
    status: str
    consecutive_failures: int
    next_check: datetime
    last_checked: datetime | None
    created_at: datetime
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


# ── Public status page ──
class PublicService(BaseModel):
    name: str
    url: str
    status: str  # up | down | paused
    uptime_24h: float
    avg_response_time: float | None
    spark: list[str] = []  # last checks: "up" | "down"
