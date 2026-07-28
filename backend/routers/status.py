from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Monitor, Check, StatusPage
from schemas import PublicService, StatusPageOut

router = APIRouter(prefix="/status", tags=["public-status"])


@router.get("/{owner_id}")
async def public_status(owner_id: int, db: AsyncSession = Depends(get_db)):
    """Public status page for a user. No auth required — safe to embed anywhere.

    Returns the owner's status-page config (theme/title/description/capabilities)
    together with the list of public services, so the page can render the
    selected theme and feature toggles.
    """
    res = await db.execute(select(Monitor).where(Monitor.owner_id == owner_id))
    monitors = list(res.scalars().all())

    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    services: list[PublicService] = []
    for m in monitors:
        total = await db.scalar(
            select(func.count(Check.id)).where(Check.monitor_id == m.id, Check.checked_at >= day_ago)
        )
        up = await db.scalar(
            select(func.count(Check.id)).where(
                Check.monitor_id == m.id, Check.checked_at >= day_ago, Check.status == "up"
            )
        )
        avg = await db.scalar(
            select(func.avg(Check.response_time)).where(
                Check.monitor_id == m.id, Check.checked_at >= day_ago,
                Check.status == "up", Check.response_time.isnot(None),
            )
        )
        spark_rows = (
            await db.execute(
                select(Check.status)
                .where(Check.monitor_id == m.id)
                .order_by(Check.checked_at.desc())
                .limit(50)
            )
        ).scalars().all()
        total = total or 0
        uptime = round(up / total * 100, 2) if total else 100.0
        state = "paused" if not m.enabled else ("down" if m.status == "down" else "up")
        services.append(PublicService(
            name=m.name, url=m.url, status=state,
            uptime_24h=uptime, avg_response_time=round(avg, 1) if avg else None,
            spark=list(reversed(spark_rows)),
        ))

    sp = await db.get(StatusPage, owner_id)
    if sp:
        config = StatusPageOut.model_validate(sp).model_dump()
    else:
        config = {
            "owner_id": owner_id,
            "title": "PulseWatch Status",
            "description": "",
            "theme": "neon",
            "show_response_time": True,
        }

    return {"config": config, "services": services}
