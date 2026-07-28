"""PulseWatch Telegram bot (long-polling).

Runs as its own process (or auto-started by the API when TELEGRAM_BOT_TOKEN
is set and NO_TELEGRAM_BOT is false). Each user links their account via
Dashboard -> Settings -> Connect Telegram, which deep-links /start <token>.
We then POST {token, chat_id} to /auth/telegram/connect to bind the chat.

Commands send the user-facing copy defined below; live data (status,
monitors, incidents) is pulled from the DB by chat_id.
"""
from asyncio import TaskGroup, create_task, sleep
import asyncio
from contextlib import asynccontextmanager

import httpx
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from models import Incident, Monitor, User
from worker import run_forever


# ── User-facing message copy ──────────────────────────────────────────────
HELP = (
    "🤖 PulseWatch Help\n\n"
    "Available commands:\n\n"
    "/status - Check the current status of your monitored services\n"
    "/incidents - View recent outages and recoveries\n"
    "/monitors - View your monitored websites and APIs\n"
    "/notifications - Manage your alert preferences\n"
    "/pause - Pause monitoring alerts\n"
    "/resume - Resume monitoring alerts\n"
    "/settings - Manage your account settings\n"
    "/about - Learn more about PulseWatch\n\n"
    "Need help? Contact PulseWatch support."
)

NOTIFICATIONS = (
    "🔔 Notification Settings\n\n"
    "Manage how you receive PulseWatch alerts.\n\n"
    "Available options:\n"
    "🟢 Enable alerts\n"
    "🔴 Disable alerts\n"
    "⚡ Configure alert preferences\n\n"
    "Use the PulseWatch dashboard to customize your settings."
)

SETTINGS = (
    "⚙️ Account Settings\n\n"
    "Manage your PulseWatch account preferences.\n\n"
    "Available settings:\n"
    "• Notification preferences\n"
    "• Monitor configuration\n"
    "• Alert rules\n"
    "• Account details\n\n"
    "Visit the PulseWatch dashboard to update your settings."
)

ABOUT = (
    "💙 About PulseWatch\n\n"
    "PulseWatch helps you monitor websites, APIs, and online services with "
    "real-time status alerts.\n\n"
    "Stay informed about downtime, recoveries, performance issues, and SSL "
    "certificate changes.\n\n"
    "Reliable monitoring. Instant notifications."
)


WELCOME = (
    "👋 Welcome to PulseWatch!\n\n"
    "I'll notify you whenever your monitored websites, APIs, or services change status.\n\n"
    "You'll receive:\n"
    "🟢 Recovery notifications\n"
    "🔴 Downtime alerts\n"
    "⚡ Performance updates\n"
    "🔒 SSL certificate reminders\n\n"
    "Configure your monitors from the PulseWatch dashboard."
)


async def _user_by_chat(db, chat_id: str) -> User | None:
    # Stable ordering (lowest id) so lookup is deterministic even if a stray
    # duplicate chat_id ever exists. The connect guard keeps ownership 1:1.
    return (await db.execute(
        select(User).where(User.telegram_chat_id == str(chat_id)).order_by(User.id)
    )).scalars().first()


async def _welcome(chat_id: str, auth_token: str | None) -> str:
    if auth_token:
        # /start <token> -> link this chat to the account
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    f"{settings.public_base_url}/auth/telegram/connect",
                    json={"token": auth_token, "chat_id": str(chat_id)},
                )
                if r.status_code == 200:
                    return ("✅ Account connected!\n\n"
                            "PulseWatch will now notify you about downtime, "
                            "recoveries, and performance changes.\n\n"
                            "Use /status to check your services, /help for commands.")
                return ("❌ That link has expired. Open Settings -> Connect Telegram "
                        "in the PulseWatch dashboard to get a fresh link.")
        except Exception as e:  # noqa: BLE001
            return f"[bot] connect failed: {e}"
    return (
        WELCOME
    )


async def _status_text(chat_id: str) -> str:
    async with AsyncSessionLocal() as db:
        user = await _user_by_chat(db, chat_id)
        if not user:
            return _not_linked()
        monitors = (await db.execute(
            select(Monitor).where(Monitor.owner_id == user.id)
        )).scalars().all()
    if not monitors:
        return ("📊 Service Status\n\n"
                "Checking your monitored services...\n\n"
                "🟢 All systems are currently operational.\n\n"
                "Use /monitors to view your active monitors.")
    up = sum(1 for m in monitors if m.status == "up")
    down = sum(1 for m in monitors if m.status == "down")
    lines = ["📊 Service Status\n"]
    for m in monitors:
        icon = "🟢" if m.status == "up" else "🔴"
        lines.append(f"{icon} {m.name} — {'Operational' if m.status == 'up' else 'Down'}")
    if down == 0:
        lines.append("\n🟢 All systems are currently operational.")
    else:
        lines.append(f"\n🔴 {down} service(s) experiencing issues.")
    lines.append("\nUse /monitors to view your active monitors.")
    return "\n".join(lines)


async def _monitors_text(chat_id: str) -> str:
    async with AsyncSessionLocal() as db:
        user = await _user_by_chat(db, chat_id)
        if not user:
            return _not_linked()
        monitors = (await db.execute(
            select(Monitor).where(Monitor.owner_id == user.id)
        )).scalars().all()
    if not monitors:
        return ("🌐 Your Monitors\n\n"
                "You currently have no monitors configured.\n\n"
                "Add your first website or API from the PulseWatch dashboard.")
    lines = ["🌐 Your Monitors\n"]
    for m in monitors:
        icon = "🟢" if m.status == "up" else "🔴"
        lines.append(f"{icon} {m.name}\n   {m.url}  ·  every {m.interval}s")
    return "\n".join(lines)


async def _incidents_text(chat_id: str) -> str:
    async with AsyncSessionLocal() as db:
        user = await _user_by_chat(db, chat_id)
        if not user:
            return _not_linked()
        rows = (await db.execute(
            select(Incident)
            .join(Monitor)
            .where(Monitor.owner_id == user.id)
            .order_by(Incident.started_at.desc())
            .limit(5)
        )).scalars().all()
    if not rows:
        return ("🚨 Recent Incidents\n\n"
                "No recent incidents found.\n\n"
                "Your monitored services have been running smoothly. 🟢")
    lines = ["🚨 Recent Incidents\n"]
    for i in rows:
        state = "✅ resolved" if i.resolved_at else "🔴 ongoing"
        lines.append(f"• {i.reason or 'Outage'} — {state}")
    return "\n".join(lines)


async def _pause(chat_id: str) -> str:
    async with AsyncSessionLocal() as db:
        user = await _user_by_chat(db, chat_id)
        if not user:
            return _not_linked()
        user.alerts_paused = True
        await db.commit()
        # Email parity
        try:
            from notifications import send_control_message
            if getattr(user, "enabled_channels", "").count("email"):
                await send_control_message(
                    "⏸ Monitoring Paused\n\nAll monitoring alerts have been paused. "
                    "You won't receive downtime or recovery notifications until resumed.\n\n"
                    "Use /resume to enable alerts again.",
                    user,
                )
        except Exception:  # noqa: BLE001
            pass
    return ("⏸ Monitoring Paused\n\n"
            "All monitoring alerts have been paused.\n\n"
            "You will not receive downtime or recovery notifications until "
            "monitoring is resumed.\n\n"
            "Use /resume to enable alerts again.")


async def _resume(chat_id: str) -> str:
    async with AsyncSessionLocal() as db:
        user = await _user_by_chat(db, chat_id)
        if not user:
            return _not_linked()
        user.alerts_paused = False
        await db.commit()
        # Email parity
        try:
            from notifications import send_control_message
            if getattr(user, "enabled_channels", "").count("email"):
                await send_control_message(
                    "▶️ Monitoring Resumed\n\nYour monitoring alerts are active again. "
                    "PulseWatch will notify you about downtimes, recoveries, and heartbeat misses.",
                    user,
                )
        except Exception:  # noqa: BLE001
            pass
    return ("▶️ Monitoring Resumed\n\n"
            "Your monitoring alerts are active again.\n\n"
            "PulseWatch will notify you about:\n"
            "🟢 Recoveries\n"
            "🔴 Downtime events\n"
            "⚡ Performance changes")


def _not_linked() -> str:
    return ("🔗 Your Telegram chat isn't linked to a PulseWatch account yet.\n\n"
            "Open the PulseWatch dashboard -> Settings -> Connect Telegram to link.")


async def _notifications_text(chat_id: str) -> str:
    async with AsyncSessionLocal() as db:
        user = await _user_by_chat(db, chat_id)
    if not user:
        return _not_linked()
    chans = [c.strip() for c in (user.enabled_channels or "").split(",") if c.strip()]
    icons = {"telegram": "📨", "email": "📧", "discord": "💬", "slack": "💡", "webhook": "🔗"}
    lines = [NOTIFICATIONS, "", "Active channels:"]
    for c in ("telegram", "email", "discord", "slack", "webhook"):
        mark = "✅" if c in chans else "⬜"
        lines.append(f"{mark} {icons.get(c, '•')} {c}")
    return "\n".join(lines)


COMMAND_HANDLERS = {
    "/help": lambda _: HELP,
    "/notifications": _notifications_text,
    "/settings": lambda _: SETTINGS,
    "/about": lambda _: ABOUT,
}


async def _handle_update(update: dict) -> tuple[str, str | None]:
    """Return (text, auth_token_or_None)."""
    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return "", None
    chat_id = msg["chat"]["id"]
    text = (msg.get("text") or "").strip()
    if not text.startswith("/"):
        return ("I didn't catch that. Send /help to see what I can do.", None)
    parts = text.split()
    cmd = parts[0].split("@")[0].lower()
    arg = parts[1] if len(parts) > 1 else None

    if cmd == "/start":
        return await _welcome(str(chat_id), arg), arg
    if cmd == "/status":
        return await _status_text(str(chat_id)), None
    if cmd == "/monitors":
        return await _monitors_text(str(chat_id)), None
    if cmd == "/incidents":
        return await _incidents_text(str(chat_id)), None
    if cmd == "/pause":
        return await _pause(str(chat_id)), None
    if cmd == "/resume":
        return await _resume(str(chat_id)), None
    if cmd in COMMAND_HANDLERS:
        result = COMMAND_HANDLERS[cmd](str(chat_id))
        if asyncio.iscoroutine(result):
            result = await result
        return result, None
    return ("🤖 Unknown command.\n\n" + HELP), None


async def _poll() -> None:
    token = settings.telegram_bot_token
    if not token:
        print("[telegram] no TELEGRAM_BOT_TOKEN — poller exiting")
        return
    url = f"https://api.telegram.org/bot{token}"
    # Validate the token before entering the loop so a bad token fails loudly.
    try:
        async with httpx.AsyncClient(timeout=30) as probe:
            r = await probe.get(f"{url}/getMe")
            me = r.json()
            if not me.get("ok"):
                print(f"[telegram] FATAL invalid bot token: {me.get('description')}")
                return
            print(f"[telegram] bot authorized as @{me['result']['username']}")
            # CRITICAL: a set webhook makes getUpdates return empty forever.
            # Always clear it so long-polling actually receives updates.
            dw = await probe.get(f"{url}/deleteWebhook", params={"drop_pending_updates": True})
            if dw.json().get("ok"):
                print("[telegram] cleared any existing webhook (switching to polling)")
    except Exception as e:  # noqa: BLE001
        print(f"[telegram] FATAL cannot reach Telegram: {e}")
        return

    offset = 0
    print("[telegram] bot polling started")
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            try:
                r = await client.get(f"{url}/getUpdates", params={"offset": offset, "timeout": 25})
                data = r.json()
                if not data.get("ok"):
                    print(f"[telegram] getUpdates error: {data.get('description')}")
                    await sleep(5)
                    continue
                for update in data.get("result", []):
                    offset = update["update_id"] + 1
                    msg = update.get("message") or update.get("edited_message")
                    chat_id = (msg or {}).get("chat", {}).get("id")
                    if not chat_id:
                        continue
                    incoming = (msg or {}).get("text", "")
                    if incoming.startswith("/"):
                        print(f"[telegram] <- {incoming.split()[0]} from chat {chat_id}")
                    text, _ = await _handle_update(update)
                    if text:
                        resp = await client.post(f"{url}/sendMessage", json={
                            "chat_id": chat_id, "text": text,
                            "disable_web_page_preview": True,
                        })
                        j = resp.json()
                        if not j.get("ok"):
                            print(f"[telegram] sendMessage failed: {j.get('description')}")
            except Exception as e:  # noqa: BLE001
                print(f"[telegram] poll error: {e}")
                await sleep(5)


if __name__ == "__main__":
    # Standalone dev runner: `python telegram_bot.py`
    import asyncio
    asyncio.run(_poll())


@asynccontextmanager
async def run_telegram_bot():
    """Lifespan helper: run the bot poller until shutdown."""
    task = create_task(_poll())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except Exception:  # noqa: BLE001
            pass


# re-export so main.py can start both loops together if desired
__all__ = ["run_telegram_bot", "run_forever"]
