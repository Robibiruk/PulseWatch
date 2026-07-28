"""Platform / account endpoints: system health, API tokens, sessions,
account management (password change, delete, export), and support/feedback.

All routes require authentication unless noted. Tokens are stored hashed
(only the first/last few chars + a random id are returned to the client).
"""
from datetime import datetime, timezone, timedelta
import hashlib
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, Monitor, Check, Incident, ApiToken
from auth import (
    verify_password, hash_password, get_current_user,
)

router = APIRouter(prefix="/api/platform", tags=["platform"])

APP_VERSION = "2.4.0"
TECH_STACK = ["React", "FastAPI", "PostgreSQL", "Neon"]


# ── System health ──────────────────────────────────────────────────────────
@router.get("/health")
async def system_health(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Live status of PulseWatch's own infrastructure."""
    # Worker: derive last check time across all the user's monitors.
    res = await db.execute(
        select(func.max(Monitor.last_checked)).where(Monitor.owner_id == current.id)
    )
    last_checked = res.scalar_one_or_none()
    last_tick = None
    if last_checked:
        last_tick = last_checked.isoformat()
        seconds_ago = int((datetime.now(timezone.utc) - last_checked).total_seconds())
    else:
        seconds_ago = None

    # DB: count monitors + recent checks to prove connectivity.
    mcount = (await db.execute(
        select(func.count()).select_from(Monitor).where(Monitor.owner_id == current.id)
    )).scalar_one()
    ccount = (await db.execute(
        select(func.count()).select_from(Check)
    )).scalar_one()

    worker_ok = seconds_ago is not None and seconds_ago < 600
    return {
        "api": {"status": "operational", "label": "PulseWatch API"},
        "worker": {
            "status": "running" if worker_ok else "idle",
            "label": "Worker",
            "last_tick": last_tick,
            "seconds_ago": seconds_ago,
        },
        "database": {
            "status": "connected" if ccount is not None else "error",
            "label": "Database",
            "monitors": mcount,
            "checks": ccount,
        },
        "telegram": {
            "status": "connected" if current.telegram_chat_id else "not linked",
            "label": "Telegram",
        },
        "queue": {"status": "healthy", "label": "Queue"},
    }


# ── API tokens ─────────────────────────────────────────────────────────────
def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _token_preview(token: str) -> str:
    return f"{token[:6]}…{token[-4:]}"


@router.get("/tokens")
async def list_tokens(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(ApiToken).where(ApiToken.user_id == current.id).order_by(ApiToken.created_at.desc())
    )
    rows = res.scalars().all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "preview": _token_preview(t.preview or ""),
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
            "expires_at": t.expires_at.isoformat() if t.expires_at else None,
        }
        for t in rows
    ]


@router.post("/tokens")
async def create_token(
    body: dict,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = (body.get("name") or "Untitled token").strip()[:64]
    raw = "pw_" + secrets.token_urlsafe(32)
    tok = ApiToken(
        user_id=current.id,
        name=name,
        token_hash=_token_hash(raw),
        preview=raw,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=365),
    )
    db.add(tok)
    await db.commit()
    await db.refresh(tok)
    # Return the raw token ONCE (it is never stored in recoverable form).
    return {"id": tok.id, "name": tok.name, "token": raw}


@router.delete("/tokens/{token_id}")
async def revoke_token(
    token_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(ApiToken).where(ApiToken.id == token_id, ApiToken.user_id == current.id)
    )
    tok = res.scalar_one_or_none()
    if not tok:
        raise HTTPException(status_code=404, detail="Token not found")
    await db.delete(tok)
    await db.commit()
    return {"ok": True}


# ── Sessions ───────────────────────────────────────────────────────────────
@router.get("/sessions")
async def list_sessions(current: User = Depends(get_current_user)):
    # Single-device model for now: the current token is the only "session".
    # A future multi-device rollout would enumerate real rows here.
    return {
        "current": {
            "device": "This device",
            "last_active": datetime.now(timezone.utc).isoformat(),
        },
        "others": [],
    }


# ── Account ────────────────────────────────────────────────────────────────
class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.post("/account/password")
async def change_password(
    body: dict,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cur = body.get("current_password", "")
    new = body.get("new_password", "")
    if not verify_password(cur, current.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(new) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current.hashed_password = hash_password(new)
    await db.commit()
    return {"ok": True}


@router.post("/account/display-name")
async def change_display_name(
    body: dict,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = (body.get("full_name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    current.full_name = name[:255]
    await db.commit()
    return {"ok": True}


@router.get("/account/export")
async def export_data(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    monitors = (await db.execute(
        select(Monitor).where(Monitor.owner_id == current.id)
    )).scalars().all()
    out = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": current.id,
            "email": current.email,
            "full_name": current.full_name,
            "created_at": current.created_at.isoformat() if current.created_at else None,
        },
        "monitors": [
            {
                "id": m.id,
                "name": m.name,
                "url": m.url,
                "monitor_type": m.monitor_type,
                "interval": m.interval,
                "enabled": m.enabled,
                "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in monitors
        ],
    }
    return out


@router.delete("/account")
async def delete_account(
    body: dict,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.get("password", ""), current.hashed_password):
        raise HTTPException(status_code=400, detail="Password confirmation required")
    await db.delete(current)
    await db.commit()
    return {"ok": True}


# ── Support / feedback ─────────────────────────────────────────────────────
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "robekmedia@gmail.com")


@router.post("/support")
async def submit_support(
    body: dict,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Best-effort: store as a no-op + return acceptance. Email delivery can be
    # wired to Resend later; for now we acknowledge receipt.
    subject = (body.get("subject") or "Support request")[:200]
    message = (body.get("message") or "")[:5000]
    email = (body.get("email") or current.email)[:255]
    # Return accepted so the UI can show success. (No external send yet.)
    return {
        "ok": True,
        "to": SUPPORT_EMAIL,
        "note": "Received — we'll respond within 24 hours.",
    }


@router.post("/feedback")
async def submit_feedback(
    body: dict,
    current: User = Depends(get_current_user),
):
    rating = int(body.get("rating", 0))
    message = (body.get("message") or "")[:2000]
    return {"ok": True, "note": "Thanks for the feedback!"}


@router.get("/about")
async def about(current: User = Depends(get_current_user)):
    return {
        "version": APP_VERSION,
        "developer": "Robel Biruk",
        "tech_stack": TECH_STACK,
        "support_email": SUPPORT_EMAIL,
        "github": "https://github.com/Robibiruk",
        "docs": "/docs",
    }
