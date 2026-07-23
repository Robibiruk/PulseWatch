"""The monitoring worker — runs on GitHub Actions every minute.

Design (the "anti-false-alarm" state machine):
  • Each due monitor is probed once per tick.
  • A single failure does NOT alert. It bumps consecutive_failures and
    schedules a fast re-check (confirmation_delay) to confirm.
  • Only after FAILURE_THRESHOLD consecutive failures do we open an
    incident and fire a Telegram alert.
  • A success while an incident is open resolves it and fires a recovery alert.

This is why PulseWatch doesn't page you for a 1-second blip.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Monitor, Check, Incident
from checker import check_site
from notifications import send_alert, format_down_alert, format_recovery_alert, format_ai_note
from ai_explain import explain_incident
from config import settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_due_monitors(db: AsyncSession) -> list[Monitor]:
    now = _now()
    stmt = select(Monitor).where(
        Monitor.enabled.is_(True),
        Monitor.next_check <= now,
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def process_monitor(db: AsyncSession, monitor: Monitor) -> None:
    result = await check_site(monitor.url)

    # persist the raw check
    check = Check(
        monitor_id=monitor.id,
        status=result.status,
        status_code=result.status_code,
        response_time=result.response_time,
        error=result.error,
    )
    db.add(check)

    if result.status == "up":
        monitor.consecutive_failures = 0
        # resolve an open incident
        if monitor.status == "down" and monitor.current_incident_id:
            incident = await db.get(Incident, monitor.current_incident_id)
            if incident and incident.resolved_at is None:
                incident.resolved_at = _now()
                started = incident.started_at
                if started.tzinfo is None:
                    started = started.replace(tzinfo=timezone.utc)
                incident.recovery_minutes = round(
                    (incident.resolved_at - started).total_seconds() / 60, 1
                )
                await send_alert(format_recovery_alert(monitor.name, monitor.url, incident))
            monitor.current_incident_id = None
        monitor.status = "up"
        monitor.last_checked = _now()
        monitor.next_check = _now() + timedelta(seconds=monitor.interval)
        await db.commit()
        return

    # failure path
    monitor.consecutive_failures += 1
    monitor.last_checked = _now()

    if monitor.status == "up" and monitor.consecutive_failures >= settings.failure_threshold:
        # open a new incident after N confirmed failures
        incident = Incident(
            monitor_id=monitor.id,
            reason=result.error or f"HTTP {result.status_code}",
            status_code=result.status_code,
        )
        db.add(incident)
        await db.flush()  # get incident.id
        monitor.status = "down"
        monitor.current_incident_id = incident.id

        explanation = await explain_incident(
            result.status_code, result.error, [result.status_code]
        )
        incident.ai_explanation = explanation

        text = format_down_alert(monitor.name, monitor.url, result, incident) + format_ai_note(explanation)
        await send_alert(text)

    # fast re-check to confirm, OR normal cadence once confirmed down
    if monitor.status == "up":
        monitor.next_check = _now() + timedelta(seconds=settings.confirmation_delay)
    else:
        monitor.next_check = _now() + timedelta(seconds=max(settings.confirmation_delay, monitor.interval))
    await db.commit()


async def run_once(db: AsyncSession) -> int:
    """Process all due monitors. Returns count processed. Used by the API /run-tick and GHA."""
    due = await _get_due_monitors(db)
    for monitor in due:
        try:
            await process_monitor(db, monitor)
        except Exception as e:  # noqa: BLE001
            await db.rollback()
            print(f"[worker] error processing monitor {monitor.id} ({monitor.url}): {e}")
    return len(due)


async def run_forever(db: AsyncSession) -> None:
    """Local long-running loop (for `python worker.py --serve`)."""
    print(f"[worker] started, poll_interval={settings.poll_interval}s, "
          f"failure_threshold={settings.failure_threshold}")
    while True:
        count = await run_once(db)
        if count:
            print(f"[worker] {count} monitor(s) checked at {_now().isoformat()}")
        # sleep until next coarse tick
        import asyncio
        await asyncio.sleep(settings.poll_interval)
