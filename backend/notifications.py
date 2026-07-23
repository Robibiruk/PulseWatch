"""Notifications: Telegram (primary) + Resend email (secondary).

If no Telegram token/chat id is configured, alerts are printed to stdout
(dev fallback) so the worker is runnable locally without credentials.
"""
import os

import httpx

from config import settings
from checker import humanize_ms


def _print_fallback(title: str, body: str) -> None:
    print("\n" + "=" * 48)
    print(f"  [ALERT — no Telegram configured] {title}")
    print("-" * 48)
    print(body)
    print("=" * 48 + "\n")


def format_down_alert(name: str, url: str, result, incident) -> str:
    reason = result.error or f"HTTP {result.status_code}"
    return (
        f"🚨 Website Down\n\n"
        f"{name}\n"
        f"{url}\n\n"
        f"Status:  {result.status_code or '—'}\n"
        f"Reason:  {reason}\n"
        f"Latency: {humanize_ms(result.response_time)}\n"
        f"Since:   {incident.started_at.strftime('%H:%M UTC')}\n"
    )


def format_recovery_alert(name: str, url: str, incident) -> str:
    rec = f"{incident.recovery_minutes:.1f} min" if incident.recovery_minutes else "—"
    return (
        f"✅ Website Recovered\n\n"
        f"{name}\n"
        f"{url}\n\n"
        f"Downtime: {rec}\n"
    )


def format_ai_note(explanation: str) -> str:
    return f"\n🤖 AI Incident Analysis\n{explanation}\n"


async def send_alert(text: str) -> None:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        _print_fallback("", text)
        if settings.resend_api_key and settings.alert_to_email:
            await _send_email("PulseWatch Alert", text)
        return

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": settings.telegram_chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, json=payload)
    except Exception as e:  # noqa: BLE001
        print(f"[notify] Telegram send failed: {e}")


async def _send_email(subject: str, body: str) -> None:
    if not settings.resend_api_key:
        return
    try:
        import resend  # imported lazily so the worker runs without the dep on the happy path

        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": settings.alert_from_email,
            "to": [settings.alert_to_email],
            "subject": subject,
            "text": body,
        })
    except Exception as e:  # noqa: BLE001
        print(f"[notify] Resend send failed: {e}")
