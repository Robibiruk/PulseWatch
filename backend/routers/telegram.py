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
    bot = settings.telegram_bot_token.split(":")[0]  # bot id prefix before ':'
    return {
        "linked": bool(current.telegram_chat_id),
        "link": f"https://t.me/{bot}?start={current.telegram_link_token}",
        "token": current.telegram_link_token,
    }


@router.post("/connect")
async def connect(payload: ConnectPayload, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(User).where(User.telegram_link_token == payload.token)
    )
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid or expired link token")
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


@router.post("/pause")
async def pause(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current.alerts_paused = True
    await db.commit()
    return {"ok": True, "alerts_paused": True}


@router.post("/resume")
async def resume(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current.alerts_paused = False
    await db.commit()
    return {"ok": True, "alerts_paused": False}
