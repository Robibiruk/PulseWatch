"""Status-page builder: per-user customization of the public status page.

A user has exactly one status_page row (keyed by owner_id). The public page
(GET /status/{owner_id}) renders their monitors using this config.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Monitor, StatusPage, User
from auth import get_current_user
from schemas import StatusPageOut, StatusPageUpdate

router = APIRouter(prefix="/status-page", tags=["statuspage"])


async def _get_or_create(db: AsyncSession, owner_id: int) -> StatusPage:
    sp = await db.get(StatusPage, owner_id)
    if not sp:
        sp = StatusPage(owner_id=owner_id)
        db.add(sp)
        await db.commit()
        await db.refresh(sp)
    return sp


@router.get("", response_model=StatusPageOut)
async def get_my_page(db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    return await _get_or_create(db, current.id)


@router.put("", response_model=StatusPageOut)
async def update_my_page(
    payload: StatusPageUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    sp = await _get_or_create(db, current.id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(sp, k, v)
    await db.commit()
    await db.refresh(sp)
    return sp


@router.get("/public/{owner_id}", response_model=dict)
async def public_page(owner_id: int, db: AsyncSession = Depends(get_db)):
    sp = await db.get(StatusPage, owner_id)
    if not sp:
        sp = StatusPage(owner_id=owner_id)
    monitors = (
        await db.execute(select(Monitor).where(Monitor.owner_id == owner_id, Monitor.enabled.is_(True)))
    ).scalars().all()
    return {
        "config": StatusPageOut.model_validate(sp).model_dump(),
        "monitors": [
            {
                "id": m.id, "name": m.name, "url": m.url,
                "status": m.status, "monitor_type": m.monitor_type,
                "ssl_expires_at": m.ssl_expires_at.isoformat() if m.ssl_expires_at else None,
            }
            for m in monitors
        ],
    }
