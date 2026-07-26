from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Monitor, Check, Incident, User
from auth import get_current_user
from schemas import (
    MonitorCreate, MonitorUpdate, MonitorOut, MonitorDetail, CheckOut, IncidentOut, IncidentOutShort, FleetSummary,
)
from worker import run_once

router = APIRouter(prefix="/monitors", tags=["monitors"])


async def _own(db, monitor_id: int, user: User) -> Monitor:
    mon = await db.get(Monitor, monitor_id)
    if not mon or mon.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return mon


async def _stats(db, monitor_id: int, since: datetime) -> tuple[float, float | None, int]:
    """Return (uptime_pct, avg_response_ms, total_checks) since `since`."""
    total = await db.scalar(
        select(func.count(Check.id)).where(
            Check.monitor_id == monitor_id, Check.checked_at >= since
        )
    )
    up = await db.scalar(
        select(func.count(Check.id)).where(
            Check.monitor_id == monitor_id, Check.checked_at >= since, Check.status == "up"
        )
    )
    avg = await db.scalar(
        select(func.avg(Check.response_time)).where(
            Check.monitor_id == monitor_id, Check.checked_at >= since,
            Check.status == "up", Check.response_time.isnot(None),
        )
    )
    total = total or 0
    uptime = (up / total * 100) if total else 100.0
    return round(uptime, 2), round(avg, 1) if avg else None, total


@router.get("/incidents", response_model=list[IncidentOutShort])
async def list_incidents(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """All incidents across the user's monitors, newest first."""
    rows = (
        await db.execute(
            select(Incident, Monitor.name)
            .join(Monitor, Monitor.id == Incident.monitor_id)
            .where(Monitor.owner_id == user.id)
            .order_by(Incident.started_at.desc())
            .limit(50)
        )
    ).all()
    out: list[IncidentOutShort] = []
    for inc, mon_name in rows:
        item = IncidentOutShort.model_validate(inc)
        item.monitor_name = mon_name
        out.append(item)
    return out


@router.get("/summary", response_model=FleetSummary)
async def fleet_summary(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """Aggregate KPIs for the dashboard."""
    res = await db.execute(select(Monitor).where(Monitor.owner_id == user.id))
    monitors = list(res.scalars().all())
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)

    up = down = paused = 0
    resp_sum = 0.0
    resp_n = 0
    up_checks = 0
    total_checks = 0
    active_incidents = 0
    for m in monitors:
        if not m.enabled:
            paused += 1
        elif m.status == "down":
            down += 1
        else:
            up += 1
        avg, _, total = await _stats(db, m.id, day_ago)
        total_checks += total
        up_checks += round(total * avg / 100) if total else 0
        if avg:
            resp_sum += avg
            resp_n += 1
        active_incidents += await db.scalar(
            select(func.count(Incident.id)).where(
                Incident.monitor_id == m.id, Incident.resolved_at.is_(None)
            )
        )
    return FleetSummary(
        total=len(monitors),
        up=up,
        down=down,
        paused=paused,
        active_incidents=active_incidents,
        avg_response=round(resp_sum / resp_n, 1) if resp_n else None,
        uptime_24h=round(up_checks / total_checks * 100, 2) if total_checks else None,
    )


@router.get("", response_model=list[MonitorOut])
async def list_monitors(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    res = await db.execute(
        select(Monitor).where(Monitor.owner_id == user.id).order_by(Monitor.created_at.desc())
    )
    monitors = list(res.scalars().all())
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    out = []
    for m in monitors:
        item = MonitorOut.model_validate(m)
        up, avg, _ = await _stats(db, m.id, day_ago)
        item.uptime_24h = up
        item.avg_response_time = avg
        out.append(item)
    return out


@router.post("", response_model=MonitorOut, status_code=201)
async def create_monitor(
    payload: MonitorCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    mon = Monitor(
        owner_id=user.id,
        name=payload.name,
        url=payload.url,
        interval=payload.interval,
        next_check=now,
    )
    db.add(mon)
    await db.commit()
    await db.refresh(mon)
    return mon


@router.get("/{monitor_id}", response_model=MonitorDetail)
async def get_monitor(
    monitor_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    mon = await _own(db, monitor_id, user)
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    checks = (
        await db.execute(
            select(Check)
            .where(Check.monitor_id == monitor_id, Check.checked_at >= day_ago)
            .order_by(Check.checked_at.desc())
            .limit(50)
        )
    ).scalars().all()
    incidents = (
        await db.execute(
            select(Incident)
            .where(Incident.monitor_id == monitor_id)
            .order_by(Incident.started_at.desc())
            .limit(10)
        )
    ).scalars().all()
    detail = MonitorDetail.model_validate(mon)
    detail.recent_checks = [CheckOut.model_validate(c) for c in checks]
    detail.recent_incidents = [IncidentOut.model_validate(i) for i in incidents]
    return detail


@router.patch("/{monitor_id}", response_model=MonitorOut)
async def update_monitor(
    monitor_id: int, payload: MonitorUpdate,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    mon = await _own(db, monitor_id, user)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(mon, k, v)
    if "interval" in data and mon.status == "up":
        # re-arm soon so the new interval takes effect quickly
        mon.next_check = datetime.now(timezone.utc) + timedelta(seconds=mon.interval)
    await db.commit()
    await db.refresh(mon)
    return mon


@router.delete("/{monitor_id}", status_code=204)
async def delete_monitor(
    monitor_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    mon = await _own(db, monitor_id, user)
    await db.delete(mon)
    await db.commit()


@router.post("/run-tick", tags=["internal"])
async def run_tick(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Manually trigger one worker tick (handy for local testing / cron-free runs)."""
    from worker import run_once
    count = await run_once()
    return {"checked": count}
