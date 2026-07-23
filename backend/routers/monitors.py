from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Monitor, Check, Incident, User
from auth import get_current_user
from schemas import (
    MonitorCreate, MonitorUpdate, MonitorOut, MonitorDetail, CheckOut, IncidentOut,
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


@router.get("", response_model=list[MonitorOut])
async def list_monitors(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    res = await db.execute(
        select(Monitor).where(Monitor.owner_id == user.id).order_by(Monitor.created_at.desc())
    )
    return list(res.scalars().all())


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
    count = await run_once(db)
    return {"checked": count}
