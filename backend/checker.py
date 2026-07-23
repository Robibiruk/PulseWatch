import math
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

TIMEOUT = 10.0


@dataclass
class CheckResult:
    status: str            # "up" | "down"
    status_code: int | None
    response_time: float | None  # milliseconds
    error: str | None


async def check_site(url: str) -> CheckResult:
    """Perform a single GET probe and return the result."""
    start = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url)
        elapsed_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        # 2xx/3xx = up; 4xx/5xx = down
        ok = 200 <= resp.status_code < 400
        return CheckResult(
            status="up" if ok else "down",
            status_code=resp.status_code,
            response_time=round(elapsed_ms, 1),
            error=None if ok else f"HTTP {resp.status_code}",
        )
    except httpx.TimeoutException:
        elapsed_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        return CheckResult("down", None, round(elapsed_ms, 1), "Timeout")
    except Exception as e:  # noqa: BLE001
        elapsed_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        return CheckResult("down", None, round(elapsed_ms, 1), f"{type(e).__name__}: {e}")


def humanize_ms(ms: float | None) -> str:
    if ms is None:
        return "—"
    return f"{math.ceil(ms)}ms" if ms < 1000 else f"{ms/1000:.1f}s"
