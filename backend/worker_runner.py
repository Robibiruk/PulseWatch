"""Entry point for the worker.

Two modes:
  python worker_runner.py          -> run a single tick then exit (used by GitHub Actions)
  python worker_runner.py --serve -> loop forever (local dev, explicit)

Note: the API auto-starts the scheduler on boot (main.lifespan).
This runner is the *explicit* path (CI / when NO_WORKER=true on the API).

Exit codes (matters for the GitHub Actions cron):
  0 - tick completed, OR the database is unavailable for an expected,
      out-of-our-control reason (provider quota exhausted / compute paused).
      The latter is logged loudly but does not fail the workflow run, because
      a red X every tick for a known billing state is just noise.
  1 - anything else. Real bugs still fail loudly.
"""
import asyncio
import sys

from database import AsyncSessionLocal, init_db
from worker import run_once, run_forever

# Substrings that indicate the DB is refusing connections for a billing /
# quota / suspension reason rather than a code defect. Matched case-insensitively
# against the exception text so we stay driver-agnostic.
_QUOTA_MARKERS = (
    "compute time quota",
    "exceeded the compute time quota",
    "project has exceeded",
    "reaching its monthly free plan limit",
    "quota",
    "is paused",
    "project is disabled",
)


def _is_quota_error(exc: BaseException) -> bool:
    text = f"{type(exc).__name__}: {exc}".lower()
    return any(marker in text for marker in _QUOTA_MARKERS)


async def main() -> None:
    await init_db()
    if "--serve" in sys.argv:
        async with run_forever():
            await asyncio.Event().wait()  # run until cancelled
    else:
        count = await run_once()
        print(f"[worker] tick complete: {count} monitor(s) processed")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:  # noqa: BLE001
        if _is_quota_error(exc):
            print(
                "[worker] SKIPPED: the database is not accepting connections "
                f"({type(exc).__name__}: {exc}).\n"
                "[worker] This is a provider quota/suspension state, not a code "
                "failure — exiting 0 so the scheduled run is not marked failed. "
                "Restore the database (upgrade the plan or wait for the quota "
                "reset) to resume monitoring."
            )
            sys.exit(0)
        raise
