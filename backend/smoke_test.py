"""Local smoke test against SQLite (no Neon needed) to prove the backend logic.

Run:  python smoke_test.py
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

from datetime import datetime, timedelta, timezone  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

import config  # noqa: E402
from database import AsyncSessionLocal, init_db  # noqa: E402
from main import app  # noqa: E402
from models import Monitor, Incident, Check  # noqa: E402
from worker import process_monitor  # noqa: E402


def banner(t): print(f"\n=== {t} ===")


async def main():
    await init_db()
    c = TestClient(app)

    # 1) register + login
    banner("auth")
    r = c.post("/auth/register", json={"email": "rob@test.dev", "password": "secret123", "full_name": "Rob"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    print("registered + got token:", bool(token))
    H = {"Authorization": f"Bearer {token}"}

    # 2) create a monitor that will FAIL (connection refused)
    banner("create monitor")
    fail_url = "http://127.0.0.1:1/"  # nothing listening -> failure
    r = c.post("/monitors", json={"name": "Dead Site", "url": fail_url, "interval": 60}, headers=H)
    assert r.status_code == 201, r.text
    mon = r.json()
    print("monitor created id=", mon["id"], "status=", mon["status"])

    # 3) run worker ticks manually -> verify anti-false-alarm state machine
    banner("worker state machine")
    async with AsyncSessionLocal() as db:
        m = await db.get(Monitor, mon["id"])
        # first failure: should NOT open incident yet
        await process_monitor(db, m)
        m = await db.get(Monitor, mon["id"])
        assert m.status == "up", f"expected still up after 1 failure, got {m.status}"
        assert m.consecutive_failures == 1
        print("after 1 failure: status=up (no false alarm) ✓")
        # second failure: threshold reached -> incident opens
        await process_monitor(db, m)
        m = await db.get(Monitor, mon["id"])
        assert m.status == "down", f"expected down after threshold, got {m.status}"
        open_inc = (await db.execute(
            select(Incident).where(Incident.monitor_id == mon["id"], Incident.resolved_at.is_(None))
        )).scalars().first()
        assert open_inc is not None
        inc = open_inc

        print("incident reason:", inc.reason)
        print("AI explanation present:", bool(inc.ai_explanation))
        assert inc.ai_explanation, "AI explanation missing"
        print("incident.reason =", inc.reason)
        print("incident.ai_explanation (rule-based) =\n", inc.ai_explanation)

        # 4) recovery: flip the monitor to point at a working URL, run tick -> resolves
        m.url = "https://example.com"
        m.consecutive_failures = 0
        m.status = "down"
        m.next_check = datetime.now(timezone.utc)
        await db.commit()
    async with AsyncSessionLocal() as db:
        m = await db.get(Monitor, mon["id"])
        await process_monitor(db, m)
        m = await db.get(Monitor, mon["id"])
        assert m.status == "up", f"expected recovery to up, got {m.status}"
        inc = (await db.execute(
            select(Incident).where(Incident.monitor_id == mon["id"], Incident.resolved_at.is_(None))
        )).scalars().first()
        print("after recovery tick: status=up ✓ ; incident resolved:", inc is None or inc.resolved_at is not None)

    # 5) checks persisted
    banner("checks persisted")
    async with AsyncSessionLocal() as db:
        total = (await db.execute(select(Check).where(Check.monitor_id == mon["id"]))).scalars().all()
        print("total checks stored:", len(total))

    # 6) public status page (no auth)
    banner("public status page")
    r = c.get(f"/status/{mon['owner_id']}")
    assert r.status_code == 200, r.text
    services = r.json()
    print("public services:", [(s["name"], s["status"], s["uptime_24h"]) for s in services])
    assert services and services[0]["name"] == "Dead Site"

    # 7) list monitors via API
    banner("list + detail")
    r = c.get("/monitors", headers=H)
    assert r.status_code == 200 and len(r.json()) == 1
    r = c.get(f"/monitors/{mon['id']}", headers=H)
    assert r.status_code == 200 and "recent_checks" in r.json()
    print("detail endpoint ok, recent_checks:", len(r.json()["recent_checks"]))

    print("\n✅ ALL SMOKE TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
