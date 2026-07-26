"""The continuous monitoring engine.

Pipeline (the heart of PulseWatch):

    Scheduler (every poll_interval)
        down find due monitors
    Queue (due monitor ids)
        down
    Workers (bounded concurrency via asyncio.Semaphore)
        down HTTP probe (checker.check_site)
    Save check (Check row)
        down
    Update state (Monitor.status / incident machine)
        down
    Trigger alerts (Telegram / email / AI note)

Design - the "anti-false-alarm" state machine (per monitor):
  - One failure does NOT alert. It bumps consecutive_failures and
    schedules a fast re-check (confirmation_delay).
  - Only after FAILURE_THRESHOLD consecutive failures do we open an
    incident and fire a Telegram alert.
  - A success while an incident is open resolves it + fires recovery.

This is why PulseWatch won't page you for a 1-second blip.

Concurrency: each monitor is processed in its own short-lived session
so failures are isolated and many sites probe in parallel (the workers stage).
"""
from asyncio import Semaphore, TaskGroup, create_task, sleep
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from ai_explain import explain_incident
from checker import check_site
from config import settings
from database import AsyncSessionLocal
from models import Check, Incident, Monitor, User
from notifications import (
    format_ai_note,
    format_down_alert,
    format_recovery_alert,
    send_alert,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_due_monitors(db, now: datetime) -> list[Monitor]:
    stmt = select(Monitor).where(
        Monitor.enabled.is_(True),
        Monitor.next_check <= now,
    )
    return list((await db.execute(stmt)).scalars().all())


async def _get_open_incident(db, monitor_id: int) -> Incident | None:
    res = await db.execute(
        select(Incident).where(
            Incident.monitor_id == monitor_id, Incident.resolved_at.is_(None)
        )
    )
    return res.scalars().first()


async def process_monitor(monitor_id: int) -> None:
    """Process a single due monitor in its own session (worker isolation)."""
    async with AsyncSessionLocal() as db:
        monitor = await db.get(Monitor, monitor_id)
        if monitor is None or not monitor.enabled:
            return
        owner = await db.get(User, monitor.owner_id)
        # if the owner paused alerts, still record state but don't notify
        notify_chat = (
            owner.telegram_chat_id if (owner and not owner.alerts_paused) else None
        )

        result = await check_site(monitor.url)

        # persist the raw check
        db.add(
            Check(
                monitor_id=monitor.id,
                status=result.status,
                status_code=result.status_code,
                response_time=result.response_time,
                error=result.error,
            )
        )

        if result.status == "up":
            monitor.consecutive_failures = 0
            if monitor.status == "down":
                incident = await _get_open_incident(db, monitor.id)
                if incident:
                    incident.resolved_at = _now()
                    started = incident.started_at
                    if started.tzinfo is None:
                        started = started.replace(tzinfo=timezone.utc)
                    incident.recovery_minutes = round(
                        (_now() - started).total_seconds() / 60, 1
                    )
                    if notify_chat:
                        await send_alert(
                            format_recovery_alert(monitor.name, monitor.url, incident),
                            chat_id=notify_chat,
                        )
            monitor.status = "up"
            monitor.last_checked = _now()
            monitor.next_check = _now() + timedelta(seconds=monitor.interval)
            await db.commit()
            return

        # failure path
        monitor.consecutive_failures += 1
        monitor.last_checked = _now()

        if monitor.status == "up" and monitor.consecutive_failures >= settings.failure_threshold:
            incident = Incident(
                monitor_id=monitor.id,
                reason=result.error or f"HTTP {result.status_code}",
                status_code=result.status_code,
            )
            db.add(incident)
            await db.flush()  # get incident.id
            monitor.status = "down"
            explanation = await explain_incident(
                result.status_code, result.error, [result.status_code]
            )
            incident.ai_explanation = explanation
            text = (
                format_down_alert(monitor.name, monitor.url, result, incident)
                + format_ai_note(explanation)
            )
            if notify_chat:
                await send_alert(text, chat_id=notify_chat)

        # fast re-check to confirm, OR normal cadence once confirmed down
        if monitor.status == "up":
            monitor.next_check = _now() + timedelta(seconds=settings.confirmation_delay)
        else:
            monitor.next_check = _now() + timedelta(
                seconds=max(settings.confirmation_delay, monitor.interval)
            )
        await db.commit()


async def run_once() -> int:
    """Scheduler tick: find due monitors, dispatch them to the worker pool."""
    now = _now()
    async with AsyncSessionLocal() as db:
        due = await _get_due_monitors(db, now)

    if not due:
        return 0

    sem = Semaphore(settings.worker_concurrency)

    async def _guarded(m: Monitor):
        async with sem:
            try:
                await process_monitor(m.id)
            except Exception as e:  # noqa: BLE001
                print(f"[worker] error processing monitor {m.id} ({m.url}): {e}")

    # bounded fan-out: the "queue -> workers" stage
    async with TaskGroup() as tg:
        for m in due:
            tg.create_task(_guarded(m))
    return len(due)


@asynccontextmanager
async def run_forever():
    """Lifespan factory: poll loop that runs until the app shuts down.

    Usage:
        async with run_forever():
            ... serve ...
    """
    task = create_task(_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except Exception:  # noqa: BLE001
            pass


async def _loop() -> None:
    print(
        f"[worker] started | poll={settings.poll_interval}s "
        f"concurrency={settings.worker_concurrency} "
        f"failure_threshold={settings.failure_threshold}"
    )
    while True:
        try:
            count = await run_once()
            if count:
                print(f"[worker] {count} monitor(s) checked @ {_now().isoformat()}")
        except Exception as e:  # noqa: BLE001
            print(f"[worker] tick error: {e}")
        await sleep(settings.poll_interval)
