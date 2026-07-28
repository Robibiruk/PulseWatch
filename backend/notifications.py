"""Notifications: multi-channel alert fan-out.

Channels: telegram, email (Resend), discord, slack, webhook.
Each user configures enabled_channels (comma list) and per-channel targets
(discord_webhook / slack_webhook / webhook_url / alert_email). Telegram uses the
linked chat id. Global config provides fallbacks when a per-user target is empty.

If no channel is deliverable, the alert is printed to stdout (dev fallback) so
the worker is runnable locally without credentials.
"""
import os
from dataclasses import dataclass

import httpx

from config import settings
from checker import humanize_ms
import emailer


def _print_fallback(title: str, body: str) -> None:
    print("\n" + "=" * 48)
    print(f"  [ALERT — no channel configured] {title}")
    print("-" * 48)
    print(body)
    print("=" * 48 + "\n")


@dataclass
class AlertTarget:
    """Resolved notification context for one monitor owner."""
    telegram_chat_id: str | None = None
    email: str | None = None
    discord_webhook: str | None = None
    slack_webhook: str | None = None
    webhook_url: str | None = None
    channels: str = "telegram,email"  # comma-separated enabled channels

    def has(self, ch: str) -> bool:
        return ch in [c.strip() for c in self.channels.split(",") if c.strip()]


async def _send_telegram(chat_id: str, text: str) -> None:
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    # NOTE: send as plain text (no parse_mode). Legacy "Markdown" 400s on
    # underscores in monitor names/URLs (e.g. cord19_sample) and silently drops
    # the alert. Our alert copy uses no markup, so plain text is correct + safe.
    payload = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=payload)
            if r.status_code != 200:
                print(f"[notify] Telegram send failed: HTTP {r.status_code} {r.text[:200]}")
    except Exception as e:  # noqa: BLE001
        print(f"[notify] Telegram send failed: {e}")


async def _post_webhook(url: str, payload: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, json=payload)
    except Exception as e:  # noqa: BLE001
        print(f"[notify] webhook post failed: {e}")


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


def format_ssl_warning(name: str, url: str, days_left: int, expires_at) -> str:
    expiry = expires_at.strftime("%Y-%m-%d") if hasattr(expires_at, "strftime") else str(expires_at)
    return (
        f"🔐 SSL Certificate Expiring\n\n"
        f"{name}\n{url}\n\n"
        f"Expires: {expiry}\n"
        f"Days left: {days_left}\n\n"
        f"Renew the certificate before it lapses to avoid outages."
    )


async def send_alert(text: str, target: AlertTarget | None = None) -> None:
    """Fan out an alert to all enabled channels for the owner.

    target - AlertTarget built from the monitor owner (preferred). When None,
             falls back to global telegram config / email.
    """
    if target is None:
        target = AlertTarget()

    delivered = False

    # Telegram
    if target.has("telegram") and settings.telegram_bot_token and target.telegram_chat_id:
        await _send_telegram(target.telegram_chat_id, text)
        delivered = True

    # Discord (render markdown-ish; use content field)
    dc = target.discord_webhook or settings.discord_webhook_url
    if target.has("discord") and dc:
        await _post_webhook(dc, {"content": text})
        delivered = True

    # Slack (uses the same incoming-webhook shape)
    sl = target.slack_webhook or settings.slack_webhook_url
    if target.has("slack") and sl:
        await _post_webhook(sl, {"text": text})
        delivered = True

    # Generic webhook (JSON envelope, useful for Zapier/Make/custom)
    wh = target.webhook_url or settings.generic_webhook_url
    if target.has("webhook") and wh:
        await _post_webhook(wh, {"event": "pulsewatch.alert", "message": text})
        delivered = True

    # Email
    em = target.email or settings.alert_to_email
    if target.has("email") and settings.resend_api_key and em:
        await _send_email("PulseWatch Alert", text, em)
        delivered = True

    if not delivered:
        _print_fallback("", text)


async def _send_email(subject: str, body: str, to: str) -> None:
    if not settings.resend_api_key:
        return
    try:
        import resend  # imported lazily so the worker runs without the dep on the happy path

        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": settings.alert_from_email,
            "to": [to],
            "subject": subject,
            "text": body,
        })
    except Exception as e:  # noqa: BLE001
        print(f"[notify] Resend send failed: {e}")


async def _send_email_html(subject: str, html: str, text: str, to: str) -> None:
    """Branded HTML email (incident / signup / login / checkin)."""
    if not settings.resend_api_key:
        # dev fallback: print so local runs are observable
        print(f"\n[email:dev] -> {to} | {subject}\n{text}\n")
        return
    try:
        import resend

        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": settings.alert_from_email,
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text,
        })
    except Exception as e:  # noqa: BLE001
        print(f"[notify] Resend HTML send failed: {e}")


async def send_incident_email(kind: str, monitor, incident=None, result=None, owner=None) -> None:
    """Branded HTML email for an incident (down/resumed).

    kind: "down" | "resolved". Sends to the owner's email if the email channel
    is enabled and Resend is configured. No-op otherwise.
    """
    if kind not in ("down", "resolved"):
        return
    if owner is None or not getattr(owner, "enabled_channels", "").count("email"):
        return
    if not settings.resend_api_key:
        return
    to = owner.alert_email or owner.email
    if not to:
        return
    name = getattr(owner, "full_name", "") or to.split("@")[0]
    if kind == "down":
        subject, html, text = emailer.incident_down(
            name, monitor.name, monitor.url,
            result.status_code if result else None,
            incident.reason if incident else (result.error if result else None),
            result.response_time if result else None,
            incident.started_at if incident else None,
            ai_note=getattr(incident, "ai_explanation", None) if incident else None,
        )
    else:
        subject, html, text = emailer.incident_resolved(
            name, monitor.name, monitor.url,
            getattr(incident, "recovery_minutes", None) if incident else None,
        )
    await _send_email_html(subject, html, text, to)


async def send_event_email(kind: str, owner, monitor=None) -> None:
    """Branded HTML email for control events (alerts paused/resumed, monitor
    stopped/resumed). Sends to the owner's email if the email channel is
    enabled and Resend is configured. No-op otherwise.

    kind: "alerts_paused" | "alerts_resumed" | "monitor_paused" | "monitor_resumed"
    """
    if owner is None or not getattr(owner, "enabled_channels", "").count("email"):
        return
    if not settings.resend_api_key:
        return
    to = owner.alert_email or owner.email
    if not to:
        return
    name = getattr(owner, "full_name", "") or to.split("@")[0]
    if kind == "alerts_paused":
        subject, html, text = emailer.alerts_paused(name)
    elif kind == "alerts_resumed":
        subject, html, text = emailer.alerts_resumed(name)
    elif kind == "monitor_paused" and monitor is not None:
        subject, html, text = emailer.monitor_paused(name, monitor.name, monitor.url)
    elif kind == "monitor_resumed" and monitor is not None:
        subject, html, text = emailer.monitor_resumed(name, monitor.name, monitor.url)
    else:
        return
    await _send_email_html(subject, html, text, to)


async def send_control_message(text: str, owner) -> None:
    """Fan out an account/monitor control message to BOTH Telegram and email
    (when each channel is enabled), so pausing/resuming is confirmed everywhere
    — not just Telegram. Mirrors send_alert but for control (non-incident) text."""
    if owner is None:
        return
    channels = (getattr(owner, "enabled_channels", "") or "").split(",")
    # Telegram
    if "telegram" in channels and settings.telegram_bot_token and getattr(owner, "telegram_chat_id", None):
        await _send_telegram(owner.telegram_chat_id, text)
    # Email
    if "email" in channels and settings.resend_api_key:
        to = getattr(owner, "alert_email", None) or getattr(owner, "email", None)
        if to:
            subject = (text.split("\n", 1)[0])[:80]
            await _send_email(subject, text, to)

