"""Heartbeat monitors: a service pings POST /api/heartbeat/{token} to prove it's alive.

If no ping arrives within the monitor's `interval`, the worker marks it down
(see worker._process_heartbeat). The token is per-monitor and returned on
creation so the user can embed it in their cron / deploy hook.
"""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Check, Incident, Monitor, User
from auth import get_current_user
from schemas import MonitorOut, MonitorCreate

router = APIRouter(prefix="/api", tags=["heartbeat"])


@router.post("/heartbeat/create", status_code=201)
async def create_heartbeat_monitor(payload: MonitorCreate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    token = secrets.token_urlsafe(24)
    monitor = Monitor(
        owner_id=current.id,
        name=payload.name,
        url=payload.url or "heartbeat://self",
        monitor_type="heartbeat",
        heartbeat_token=token,
        interval=payload.interval or 60,
        next_check=datetime.now(timezone.utc),
    )
    db.add(monitor)
    await db.commit()
    await db.refresh(monitor)
    return {**MonitorOut.model_validate(monitor).model_dump(), "heartbeat_token": token}


@router.post("/heartbeat/{token}")
async def ping(token: str, db: AsyncSession = Depends(get_db), request: Request = None):
    monitor = (await db.execute(select(Monitor).where(Monitor.heartbeat_token == token))).scalars().first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Unknown heartbeat token")
    monitor.last_heartbeat = datetime.now(timezone.utc)
    monitor.last_checked = monitor.last_heartbeat
    # a fresh ping should resolve a heartbeat-incident and mark up immediately
    if monitor.status == "down":
        monitor.status = "up"
        monitor.consecutive_failures = 0
        inc = (await db.execute(
            select(Incident).where(Incident.monitor_id == monitor.id, Incident.resolved_at.is_(None))
        )).scalars().first()
        if inc:
            inc.resolved_at = monitor.last_heartbeat
    db.add(Check(monitor_id=monitor.id, status="up", status_code=None, response_time=None, error=None))
    await db.commit()
    return {"ok": True, "monitor": monitor.name, "status": monitor.status}


@router.get("/monitors/{monitor_id}/heartbeat-token", response_model=dict)
async def get_token(monitor_id: int, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    monitor = await db.get(Monitor, monitor_id)
    if not monitor or monitor.owner_id != current.id:
        raise HTTPException(status_code=404, detail="Monitor not found")
    if monitor.monitor_type != "heartbeat":
        raise HTTPException(status_code=400, detail="Not a heartbeat monitor")
    if not monitor.heartbeat_token:
        monitor.heartbeat_token = secrets.token_urlsafe(24)
        await db.commit()
    return {"heartbeat_token": monitor.heartbeat_token}
