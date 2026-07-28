"""Telegram account-linking endpoints.

Flow:
  1. Dashboard calls GET /auth/telegram/link  -> receives a unique link_token
     (stored on the user row) and a t.me link to open.
  2. User opens the link -> Telegram deep-links to the bot with /start <token>.
  3. The bot (telegram_bot.py) calls POST /auth/telegram/connect {token, chat_id}
     -> we bind chat_id to the user and clear the token.
  4. Alerts route to that chat_id; bot commands read the user's data.
"""
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import User
from auth import get_current_user

router = APIRouter(prefix="/auth/telegram", tags=["telegram"])


class ConnectPayload(BaseModel):
    token: str
    chat_id: str


@router.get("/link")
async def link(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=503, detail="Telegram bot is not configured on the server")
    # (re)generate a single-use link token
    current.telegram_link_token = secrets.token_urlsafe(24)
    await db.commit()
    # Resolve the bot USERNAME (not the numeric id) so the deep link is valid.
    # t.me/<numeric_id> is invalid and falls through to telegram.org; we need
    # the @username from getMe.
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            me = (await c.get(f"https://api.telegram.org/bot{settings.telegram_bot_token}/getMe")).json()
        bot_username = me.get("result", {}).get("username") if me.get("ok") else None
    except Exception:  # noqa: BLE001
        bot_username = None
    if not bot_username:
        raise HTTPException(status_code=502, detail="Could not resolve bot username from Telegram")
    token = current.telegram_link_token
    return {
        "linked": bool(current.telegram_chat_id),
        "bot_username": bot_username,
        "link": f"https://t.me/{bot_username}?start={token}",
        "token": token,
    }


@router.post("/connect")
async def connect(payload: ConnectPayload, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(User).where(User.telegram_link_token == payload.token)
    )
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid or expired link token")
    # Enforce 1:1 — a Telegram chat may belong to exactly one PulseWatch account.
    # Block linking a chat already bound to a *different* account (prevents the
    # "fluctuation" where two accounts share a chat_id and bot commands/alerts
    # flip between them). Re-linking your own chat is idempotent (self excluded).
    clash = await db.execute(
        select(User).where(
            User.telegram_chat_id == payload.chat_id,
            User.id != user.id,
        )
    )
    if clash.scalars().first():
        raise HTTPException(
            status_code=409,
            detail="This Telegram chat is already linked to another PulseWatch account. "
            "Unlink it from that account first, or link from a different Telegram chat.",
        )
    user.telegram_chat_id = payload.chat_id
    user.telegram_link_token = None
    await db.commit()
    return {"ok": True, "user_id": user.id}


@router.post("/unlink")
async def unlink(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current.telegram_chat_id = None
    current.telegram_link_token = None
    current.alerts_paused = False
    await db.commit()
    return {"ok": True}


class ChannelsPayload(BaseModel):
    enabled_channels: str | None = None  # comma list: telegram,email,discord,slack,webhook
    alert_email: str | None = None
    discord_webhook: str | None = None
    slack_webhook: str | None = None
    webhook_url: str | None = None


@router.get("/channels")
async def get_channels(current: User = Depends(get_current_user)):
    return {
        "enabled_channels": current.enabled_channels,
        "alert_email": current.alert_email,
        "discord_webhook": bool(current.discord_webhook),
        "slack_webhook": bool(current.slack_webhook),
        "webhook_url": bool(current.webhook_url),
    }


@router.post("/channels")
async def set_channels(payload: ChannelsPayload, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if payload.enabled_channels is not None:
        allowed = {"telegram", "email", "discord", "slack", "webhook"}
        chosen = [c.strip().lower() for c in payload.enabled_channels.split(",") if c.strip()]
        invalid = set(chosen) - allowed
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid channels: {', '.join(invalid)}")
        current.enabled_channels = ",".join(chosen)
    for field in ("alert_email", "discord_webhook", "slack_webhook", "webhook_url"):
        val = getattr(payload, field)
        if val is not None:
            setattr(current, field, val or None)
    await db.commit()
    return {"ok": True, "enabled_channels": current.enabled_channels}


@router.post("/pause")
async def pause(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current.alerts_paused = True
    await db.commit()
    from notifications import send_control_message
    await send_control_message(
        "⏸ Monitoring Paused\n\nAll monitoring alerts have been paused. "
        "You won't receive downtime or recovery notifications until resumed.\n\n"
        "Use /resume (or Settings) to enable alerts again.",
        current,
    )
    return {"ok": True, "alerts_paused": True}


@router.post("/resume")
async def resume(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current.alerts_paused = False
    await db.commit()
    from notifications import send_control_message
    await send_control_message(
        "▶️ Monitoring Resumed\n\nYour monitoring alerts are active again. "
        "PulseWatch will notify you about downtimes, recoveries, and heartbeat misses.",
        current,
    )
    return {"ok": True, "alerts_paused": False}
