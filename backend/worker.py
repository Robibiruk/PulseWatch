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
import secrets

from sqlalchemy import select

from ai_explain import explain_incident
from checker import check_site
from config import settings
from database import AsyncSessionLocal
from models import Check, Incident, Monitor, User
from notifications import send_incident_email
from notifications import (
    AlertTarget,
    format_ai_note,
    format_down_alert,
    format_recovery_alert,
    format_ssl_warning,
    send_alert,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_due_monitors(db, now: datetime) -> list[Monitor]:
    """Return due, unclaimed monitors and atomically CLAIM them for this
    worker instance.

    The claim prevents two worker instances (e.g. two Render replicas) from
    processing the same monitor — which would cause duplicate checks and
    duplicate alerts.

    Strategy:
      * Postgres: `SELECT ... FOR UPDATE SKIP LOCKED` + a lease (claimed_until).
        SKIP LOCKED makes concurrent workers skip rows another worker is
        claiming, so the split is clean with zero duplicate work.
      * SQLite (dev, single instance): row locking isn't supported, so we fall
        back to a short lease on `claimed_until`. Fine because there is only
        one writer.
    """
    from sqlalchemy import text as _text
    lease = now + timedelta(seconds=max(30, settings.poll_interval * 2))
    token = secrets.token_urlsafe(16)

    dialect = settings.database_url.split(":", 1)[0]
    if dialect.startswith("postgresql"):
        # One round-trip: lock + claim due, unclaimed, or expired-lease rows.
        stmt = (
            select(Monitor)
            .where(
                Monitor.enabled.is_(True),
                Monitor.next_check <= now,
                (Monitor.claimed_until.is_(None)) | (Monitor.claimed_until < now),
            )
            .with_for_update(skip_locked=True)
        )
        rows = (await db.execute(stmt)).scalars().all()
        for m in rows:
            m.claim_token = token
            m.claimed_until = lease
        await db.flush()
        return list(rows)
    else:
        # SQLite fallback: claim via lease, then re-select what we claimed.
        due = (
            select(Monitor)
            .where(
                Monitor.enabled.is_(True),
                Monitor.next_check <= now,
                (Monitor.claimed_until.is_(None)) | (Monitor.claimed_until < now),
            )
        )
        rows = (await db.execute(due)).scalars().all()
        for m in rows:
            m.claim_token = token
            m.claimed_until = lease
        await db.flush()
        return list(rows)


async def _get_open_incident(db, monitor_id: int) -> Incident | None:
    res = await db.execute(
        select(Incident).where(
            Incident.monitor_id == monitor_id, Incident.resolved_at.is_(None)
        )
    )
    return res.scalars().first()


async def _process_heartbeat(monitor: Monitor, db, target) -> None:
    """Heartbeat monitors are 'up' only if pinged within `interval` seconds.

    If the last ping is missing or older than `interval`, the service is
    considered down and an incident is opened. A successful ping resets this.
    """
    now = _now()
    lb = monitor.last_heartbeat
    if lb is not None and lb.tzinfo is None:
        lb = lb.replace(tzinfo=timezone.utc)
    fresh = lb and (now - lb).total_seconds() <= monitor.interval
    is_up = bool(fresh)

    db.add(Check(
        monitor_id=monitor.id,
        status="up" if is_up else "down",
        status_code=None,
        response_time=None,
        error=None if is_up else "Heartbeat not received",
    ))

    if is_up:
        monitor.consecutive_failures = 0
        if monitor.status == "down":
            incident = await _get_open_incident(db, monitor.id)
            if incident:
                incident.resolved_at = now
                if incident.started_at.tzinfo is None:
                    incident.started_at = incident.started_at.replace(tzinfo=timezone.utc)
                incident.recovery_minutes = round((now - incident.started_at).total_seconds() / 60, 1)
                if target:
                    await send_alert(format_recovery_alert(monitor.name, monitor.url, incident), target=target)
        monitor.status = "up"
    else:
        if monitor.status == "up":
            monitor.consecutive_failures += 1
            if monitor.consecutive_failures >= settings.failure_threshold:
                incident = Incident(
                    monitor_id=monitor.id,
                    reason="Heartbeat not received",
                    status_code=None,
                )
                db.add(incident)
                await db.flush()
                monitor.status = "down"
                if target:
                    await send_alert(
                        format_down_alert(monitor.name, monitor.url,
                                          type("R", (), {"error": "Heartbeat missed", "status_code": None, "response_time": None})(),
                                          incident),
                        target=target,
                    )
        else:
            monitor.consecutive_failures += 1

    monitor.last_checked = now
    monitor.next_check = now + timedelta(seconds=monitor.interval)
    await db.commit()


async def process_monitor(monitor_id: int) -> None:
    """Process a single due monitor in its own session (worker isolation)."""
    async with AsyncSessionLocal() as db:
        monitor = await db.get(Monitor, monitor_id)
        if monitor is None or not monitor.enabled:
            return
        owner = await db.get(User, monitor.owner_id)
        # if the owner paused alerts, still record state but don't notify
        if owner and not owner.alerts_paused:
            target = AlertTarget(
                telegram_chat_id=owner.telegram_chat_id,
                email=owner.alert_email,
                discord_webhook=owner.discord_webhook,
                slack_webhook=owner.slack_webhook,
                webhook_url=owner.webhook_url,
                channels=owner.enabled_channels,
            )
        else:
            target = None

        if monitor.monitor_type == "heartbeat":
            await _process_heartbeat(monitor, db, target)
            return

        result = await check_site(
            monitor.url,
            request_timeout=monitor.request_timeout,
            follow_redirects=monitor.follow_redirects,
            ip_version=monitor.ip_version,
            http_method=monitor.http_method,
            auth_type=monitor.auth_type,
            auth_user=monitor.auth_user,
            auth_pass=monitor.auth_pass,
            auth_bearer=monitor.auth_bearer,
            up_status_codes=monitor.up_status_codes,
            check_ssl=monitor.check_ssl,
        )
        if result.ssl_expires_at:
            monitor.ssl_expires_at = result.ssl_expires_at
            # SSL expiry warning (one-time per cert cycle)
            days_left = (result.ssl_expires_at - _now()).days
            if days_left <= settings.ssl_warn_days and not monitor.ssl_warned:
                monitor.ssl_warned = True
                if target:
                    await send_alert(
                        format_ssl_warning(monitor.name, monitor.url, days_left, result.ssl_expires_at),
                        target=target,
                    )
            elif days_left > settings.ssl_warn_days:
                monitor.ssl_warned = False  # reset for next cycle

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
                    if target:
                        await send_alert(
                            format_recovery_alert(monitor.name, monitor.url, incident),
                            target=target,
                        )
                        await send_incident_email("resolved", monitor, incident=incident, owner=owner)
            monitor.status = "up"
            monitor.last_checked = _now()
            monitor.next_check = _now() + timedelta(seconds=monitor.interval)
            monitor.claimed_until = None  # release the distributed claim
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
            if target:
                await send_alert(text, target=target)
                await send_incident_email("down", monitor, incident=incident, result=result, owner=owner)

        # fast re-check to confirm, OR normal cadence once confirmed down
        if monitor.status == "up":
            monitor.next_check = _now() + timedelta(seconds=settings.confirmation_delay)
        else:
            monitor.next_check = _now() + timedelta(
                seconds=max(settings.confirmation_delay, monitor.interval)
            )
        monitor.claimed_until = None  # release the distributed claim
        await db.commit()


async def run_checkins() -> int:
    """Periodic 'check-in' digest: one summary per user with monitors.

    Sends a branded email (if email channel enabled + Resend configured) and a
    Telegram summary (if linked) so users get a regular wellbeing pulse even
    when nothing is broken. Throttled by last_checkin_at per user.
    """
    from sqlalchemy import func
    from notifications import _send_email_html, send_alert
    from emailer import checkin as build_checkin
    now = _now()
    window = timedelta(minutes=settings.checkin_interval_minutes)
    sent = 0

    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        for user in users:
            if user.alerts_paused:
                continue
            last = user.last_checkin_at
            if last is not None and last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if last and (now - last) < window:
                continue
            monitors = (await db.execute(
                select(Monitor).where(Monitor.owner_id == user.id)
            )).scalars().all()
            if not monitors:
                continue
            # Build the monitor digest rows (latest response time per monitor)
            rows = []
            for m in monitors:
                last = (await db.execute(
                    select(Check.response_time)
                    .where(Check.monitor_id == m.id, Check.response_time.isnot(None))
                    .order_by(Check.checked_at.desc())
                    .limit(1)
                )).scalars().first()
                rows.append({
                    "name": m.name,
                    "url": m.url,
                    "status": m.status,
                    "response_time_ms": last,
                })
            name = user.full_name or user.email.split("@")[0]
            subject, html, text = build_checkin(name, rows)

            # Email
            channels = (user.enabled_channels or "").split(",")
            if "email" in channels and settings.resend_api_key:
                to = user.alert_email or user.email
                if to:
                    await _send_email_html(subject, html, text, to)
            # Telegram
            if "telegram" in channels and user.telegram_chat_id and settings.telegram_bot_token:
                from notifications import AlertTarget
                await send_alert(text, target=AlertTarget(
                    telegram_chat_id=user.telegram_chat_id,
                    channels="telegram",
                ))
            user.last_checkin_at = now
            sent += 1
        await db.commit()
    return sent


async def run_once() -> int:
    """Scheduler tick: find due, unclaimed monitors, claim them, then dispatch
    to the worker pool. The claim (set inside _get_due_monitors) guarantees no
    two worker instances process the same monitor."""
    now = _now()
    async with AsyncSessionLocal() as db:
        due = await _get_due_monitors(db, now)
        # commit the claim so sibling instances see it before we finish
        await db.commit()

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
    last_checkin = _now() - timedelta(minutes=settings.checkin_interval_minutes)
    while True:
        try:
            count = await run_once()
            if count:
                print(f"[worker] {count} monitor(s) checked @ {_now().isoformat()}")
            # periodic check-in digest (default daily)
            if (now := _now()) - last_checkin >= timedelta(minutes=settings.checkin_interval_minutes):
                try:
                    n = await run_checkins()
                    if n:
                        print(f"[worker] check-in digest sent to {n} user(s)")
                except Exception as e:  # noqa: BLE001
                    print(f"[worker] checkin error: {e}")
                last_checkin = now
        except Exception as e:  # noqa: BLE001
            print(f"[worker] tick error: {e}")
        await sleep(settings.poll_interval)
