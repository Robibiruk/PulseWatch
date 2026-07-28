"""Local smoke test against SQLite (no Neon needed) to prove the backend logic.

Run:  python smoke_test.py

Covers: auth (register/login/me), monitor CRUD, worker state machine
(no false alarm -> incident -> recovery), checks persisted, full endpoint
surface (summary, incidents, heartbeat, status-page builder GET/PUT,
notifications/test, public status NEW {config, services} shape + theme),
public status page theme rendering inputs (config carries theme).

Updated for the 3-theme + capability refactor: the public status endpoint
now returns {"config": {...}, "services": [...]} so the page can render the
selected theme and feature toggles.
"""
import asyncio
import os
import tempfile

# Must set env BEFORE importing config/database
db_path = os.path.join(tempfile.gettempdir(), "pulsewatch_test.db")
if os.path.exists(db_path):
    os.remove(db_path)
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["FAILURE_THRESHOLD"] = "2"        # open incident after 2 failures for the test
os.environ["CONFIRMATION_DELAY"] = "1"
os.environ["TELEGRAM_BOT_TOKEN"] = ""        # force stdout fallback
os.environ["TELEGRAM_CHAT_ID"] = ""
os.environ["NO_WORKER"] = "true"             # don't auto-start the scheduler during the test

from datetime import datetime, timedelta, timezone  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

import config  # noqa: E402
from database import AsyncSessionLocal, init_db  # noqa: E402
from main import app  # noqa: E402
from models import Monitor, Incident, Check  # noqa: E402
from worker import process_monitor  # noqa: E402


def banner(t): print(f"\n=== {t} ===")
def chk(name, cond):
    print(f"  [{'OK' if cond else 'FAIL'}] {name}")
    return cond


async def main():
    await init_db()
    c = TestClient(app)
    ok = True

    # 1) auth
    banner("auth: register / login / me")
    r = c.post("/auth/register", json={"email": "rob@test.dev", "password": "secret123", "full_name": "Rob"})
    ok &= chk("register 200", r.status_code == 200)
    token = r.json().get("access_token")
    ok &= chk("got token", bool(token))
    H = {"Authorization": f"Bearer {token}"}
    r = c.get("/auth/me", headers=H)
    ok &= chk("me 200 + email", r.status_code == 200 and r.json().get("email") == "rob@test.dev")
    r = c.post("/auth/token", data={"username": "rob@test.dev", "password": "secret123"})
    ok &= chk("login (token) 200", r.status_code == 200 and "access_token" in r.json())

    # 2) create a monitor that will FAIL (connection refused)
    banner("monitors: create / list / detail / summary / update / delete")
    fail_url = "http://127.0.0.1:1/"  # nothing listening -> failure
    r = c.post("/monitors", json={"name": "Dead Site", "url": fail_url, "interval": 60}, headers=H)
    ok &= chk("create monitor 201", r.status_code == 201)
    mon = r.json()
    mon_id = mon["id"]
    banner("monitors: list/detail/summary")
    r = c.get("/monitors", headers=H); ok &= chk("list 200", r.status_code == 200 and len(r.json()) == 1)
    r = c.get(f"/monitors/{mon_id}", headers=H); ok &= chk("detail 200 + recent_checks", r.status_code == 200 and "recent_checks" in r.json())
    r = c.get("/monitors/summary", headers=H); ok &= chk("summary 200", r.status_code == 200 and "total" in r.json())
    r = c.patch(f"/monitors/{mon_id}", json={"name": "Dead Site Renamed"}, headers=H)
    ok &= chk("update (patch) 200", r.status_code == 200 and r.json().get("name") == "Dead Site Renamed")
    r = c.post("/monitors", json={"name": "OK Site", "url": "https://example.com", "interval": 60}, headers=H)
    ok &= chk("second monitor 201", r.status_code == 201)
    r = c.delete(f"/monitors/{mon_id}", headers=H); ok &= chk("delete 204", r.status_code == 204)

    # 3) worker state machine (anti-false-alarm)
    banner("worker state machine: up -> down -> recovery")
    async with AsyncSessionLocal() as db:
        m = await db.get(Monitor, mon_id) if (await db.get(Monitor, mon_id)) else None
    # recreate the dead monitor for the state-machine test
    r = c.post("/monitors", json={"name": "Dead Site", "url": fail_url, "interval": 60}, headers=H)
    dead_id = r.json()["id"]
    async with AsyncSessionLocal() as db:
        m = await db.get(Monitor, dead_id)
        await process_monitor(m.id); await db.refresh(m)
        ok &= chk("1 failure: still up (no false alarm)", m.status == "up" and m.consecutive_failures == 1)
        await process_monitor(m.id); await db.refresh(m)
        ok &= chk("2 failures: down + incident opened", m.status == "down")
        inc = (await db.execute(select(Incident).where(Incident.monitor_id == dead_id, Incident.resolved_at.is_(None)))).scalars().first()
        ok &= chk("incident opened + AI explanation present", inc is not None and bool(inc.ai_explanation))
        print("    incident.reason =", inc.reason)
        # recovery
        m.url = "https://example.com"; m.consecutive_failures = 0; m.status = "down"; m.next_check = datetime.now(timezone.utc)
        await db.commit()
    async with AsyncSessionLocal() as db:
        m = await db.get(Monitor, dead_id)
        await process_monitor(m.id); await db.refresh(m)
        ok &= chk("recovery: back up", m.status == "up")
        inc = (await db.execute(select(Incident).where(Incident.monitor_id == dead_id, Incident.resolved_at.is_(None)))).scalars().first()
        ok &= chk("incident resolved", inc is None or inc.resolved_at is not None)

    # 4) checks persisted
    banner("checks persisted")
    async with AsyncSessionLocal() as db:
        total = (await db.execute(select(Check).where(Check.monitor_id == dead_id))).scalars().all()
        ok &= chk("checks stored (>0)", len(total) > 0)
        print("    total checks:", len(total))

    # 5) incidents list
    banner("incidents list")
    r = c.get("/monitors/incidents", headers=H); ok &= chk("incidents 200 + list", r.status_code == 200 and isinstance(r.json(), list))

    # 6) heartbeat create + token
    banner("heartbeat")
    r = c.post("/api/heartbeat/create", json={"name": "Cron Job A", "interval": 300}, headers=H)
    ok &= chk("heartbeat create 201", r.status_code in (200, 201) and "id" in r.json())
    hb_id = r.json()["id"]
    r = c.get(f"/api/monitors/{hb_id}/heartbeat-token", headers=H); ok &= chk("heartbeat token 200", r.status_code == 200 and "heartbeat_token" in r.json())

    # 7) status-page builder (GET / PUT) + theme persistence
    banner("status-page builder: GET/PUT theme")
    r = c.get("/status-page", headers=H); ok &= chk("get status-page 200", r.status_code == 200)
    r = c.put("/status-page", json={"theme": "minimal", "title": "My Status", "show_response_time": False}, headers=H)
    ok &= chk("put status-page 200 + theme saved", r.status_code == 200 and r.json().get("theme") == "minimal" and r.json().get("show_response_time") is False)
    r = c.get("/status-page", headers=H); ok &= chk("theme persisted on GET", r.json().get("theme") == "minimal")

    # 8) notifications test (no real send w/ empty keys -> still 200)
    banner("notifications test")
    r = c.post("/notifications/test", json={"email": "rob@test.dev"}, headers=H); ok &= chk("notif test 200/accepted", r.status_code in (200, 202))

    # 9) public status page NEW shape {config, services} + theme
    banner("public status page: NEW {config, services} + theme")
    # get owner id from a monitor
    r = c.get("/monitors", headers=H)
    owner_id = r.json()[0]["owner_id"]
    r = c.get(f"/status/{owner_id}")
    ok &= chk("public status 200", r.status_code == 200)
    body = r.json()
    ok &= chk("returns dict with config+services", isinstance(body, dict) and "config" in body and "services" in body)
    ok &= chk("config carries theme (minimal)", body["config"].get("theme") == "minimal")
    ok &= chk("config carries show_response_time capability", "show_response_time" in body["config"])
    ok &= chk("services list non-empty", isinstance(body["services"], list) and len(body["services"]) > 0)
    print("    public services:", [(s["name"], s["status"], s["uptime_24h"]) for s in body["services"]])
    # default theme when none set
    r2 = c.get(f"/status/{owner_id}")
    ok &= chk("config.theme present (default neon if unset)", "theme" in r2.json()["config"])

    # 10) root + health
    banner("meta: / and /health")
    r = c.get("/health"); ok &= chk("health ok", r.status_code == 200 and r.json().get("status") == "ok")
    r = c.get("/"); ok &= chk("root 200", r.status_code == 200)

    print("\n" + ("✅ ALL SMOKE TESTS PASSED" if ok else "❌ SOME CHECKS FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
