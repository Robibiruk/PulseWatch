"""Test-notification endpoint.

Lets a signed-in user fire a real sample alert (incident DOWN + RESOLVED email,
and/or a Telegram test ping) to verify their channels work before relying on them.

This is the single best way to target "certain users / emails":
  - account-bound: uses the user's own email / alert_email + enabled_channels
  - arbitrary: pass an explicit `email` to send the sample to any address
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import User
from auth import get_current_user
import emailer
import notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


class TestPayload(BaseModel):
    email: Optional[str] = None          # send to an arbitrary address (optional)
    channels: Optional[list[str]] = None  # subset of ["email","telegram"]


@router.post("/test")
async def test_notification(
    payload: TestPayload,
    current: User = Depends(get_current_user),
):
    results: dict = {}
    allowed = {"email", "telegram"}

    if payload.channels:
        chans = {c for c in payload.channels if c in allowed}
    else:
        chans = {c for c in (current.enabled_channels or "telegram,email").split(",") if c in allowed}

    # ---- Email ----
    if "email" in chans:
        if not settings.resend_api_key:
            results["email"] = {
                "ok": False,
                "note": "RESEND_API_KEY is not set on the server — emails only print to console (dev fallback). Set RESEND_API_KEY + ALERT_FROM_EMAIL to send for real.",
            }
        else:
            to = payload.email or current.alert_email or current.email
            if not to:
                results["email"] = {"ok": False, "note": "No destination email — set alert_email or pass `email`."}
            else:
                name = current.full_name or to.split("@")[0]
                s1, h1, t1 = emailer.incident_down(
                    name, "PulseWatch Test Monitor", "https://example.com",
                    503, "HTTP 503 (this is a test)", 412, datetime.now(timezone.utc),
                    ai_note="This is a test notification — no real outage occurred.",
                )
                await notifications._send_email_html(s1, h1, t1, to)
                s2, h2, t2 = emailer.incident_resolved(
                    name, "PulseWatch Test Monitor", "https://example.com", 0.3,
                )
                await notifications._send_email_html(s2, h2, t2, to)
                results["email"] = {"ok": True, "to": to}

    # ---- Telegram ----
    if "telegram" in chans:
        if not current.telegram_chat_id:
            results["telegram"] = {"ok": False, "note": "Telegram is not linked to this account."}
        else:
            await notifications.send_alert(
                "✅ PulseWatch test — your Telegram alerts are working! "
                "You'll get the same kind of ping on real incidents and recoveries.",
                target=notifications.AlertTarget(
                    telegram_chat_id=current.telegram_chat_id, channels="telegram",
                ),
            )
            results["telegram"] = {"ok": True}

    if not chans:
        results["_"] = {"ok": False, "note": "No valid channel requested. Use email and/or telegram."}

    return {"ok": True, "results": results}
