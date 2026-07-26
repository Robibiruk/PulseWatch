"""Entry point for the worker.

Two modes:
  python worker_runner.py          -> run a single tick then exit (used by GitHub Actions)
  python worker_runner.py --serve -> loop forever (local dev, explicit)

Note: the API auto-starts the scheduler on boot (main.lifespan).
This runner is the *explicit* path (CI / when NO_WORKER=true on the API).
"""
import asyncio
import sys

from database import AsyncSessionLocal, init_db
from worker import run_once, run_forever


async def main() -> None:
    await init_db()
    if "--serve" in sys.argv:
        async with run_forever():
            await asyncio.Event().wait()  # run until cancelled
    else:
        count = await run_once()
        print(f"[worker] tick complete: {count} monitor(s) processed")


if __name__ == "__main__":
    asyncio.run(main())
