"""Entry point for the worker.

Two modes:
  python worker_runner.py          -> run a single tick then exit (used by GitHub Actions)
  python worker_runner.py --serve  -> loop forever (local dev)
"""
import asyncio
import sys

from database import AsyncSessionLocal, init_db
from worker import run_once, run_forever


async def main() -> None:
    await init_db()
    async with AsyncSessionLocal() as db:
        if "--serve" in sys.argv:
            await run_forever(db)
        else:
            count = await run_once(db)
            print(f"[worker] tick complete: {count} monitor(s) processed")


if __name__ == "__main__":
    asyncio.run(main())
