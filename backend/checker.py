import math
import socket
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

TIMEOUT = 10.0


# ── SSRF protection ────────────────────────────────────────────────────
# Block private/loopback/link-local/metadata/ULA ranges.

_PRIVATE_PREFIXES = (
    "127.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
    "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
    "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
    "192.168.", "0.", "169.254.", "100.64.",
)


def _is_private_ip(ip: str) -> bool:
    """Check if an IPv4 address is in a private/link-local/metadata range."""
    if ip in ("::1", "::ffff:127.0.0.1"):
        return True
    if ip.startswith("fc") or ip.startswith("fe80"):
        return True
    return any(ip.startswith(p) for p in _PRIVATE_PREFIXES)


def _is_safe_target(hostname: str) -> bool:
    """Resolve hostname and reject private/loopback/metadata IPs."""
    try:
        results = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for res in results:
            ip = res[4][0]
            if _is_private_ip(ip):
                return False
    except (socket.gaierror, OSError):
        return False
    return True

# Mapping of "up" code-bucket strings (2xx/3xx/4xx/5xx) to numeric ranges.
_UP_BUCKETS = {
    "2xx": range(200, 300),
    "3xx": range(300, 400),
    "4xx": range(400, 500),
    "5xx": range(500, 600),
}


@dataclass
class CheckResult:
    status: str            # "up" | "down"
    status_code: int | None
    response_time: float | None  # milliseconds
    error: str | None
    ssl_expires_at: datetime | None = None


def _resolve_up_codes(up_status_codes: str | None) -> set[int]:
    """Translate the stored up-status-codes string (e.g. '2xx,3xx') to a set."""
    buckets = (up_status_codes or "2xx,3xx").split(",")
    codes: set[int] = set()
    for b in buckets:
        b = b.strip().lower()
        if b in _UP_BUCKETS:
            codes.update(_UP_BUCKETS[b])
    return codes or set(_UP_BUCKETS["2xx"]) | set(_UP_BUCKETS["3xx"])


async def check_site(
    url: str,
    *,
    request_timeout: int | None = None,
    follow_redirects: bool = True,
    ip_version: str = "auto",
    http_method: str = "GET",
    auth_type: str = "none",
    auth_user: str | None = None,
    auth_pass: str | None = None,
    auth_bearer: str | None = None,
    up_status_codes: str | None = None,
    check_ssl: bool = True,
) -> CheckResult:
    """Perform a single probe honouring the monitor's configuration."""
    if not url:
        return CheckResult("down", None, None, "Empty URL")

    method = (http_method or "GET").upper()
    timeout = float(request_timeout or TIMEOUT)
    headers = {}
    auth = None
    if auth_type == "basic" and auth_user is not None:
        auth = (auth_user, auth_pass or "")
    elif auth_type == "bearer" and auth_bearer:
        headers["Authorization"] = f"Bearer {auth_bearer}"

    up_codes = _resolve_up_codes(up_status_codes)

    # SSRF protection: reject private/loopback/metadata targets
    parsed = urlparse(url)
    hostname = parsed.hostname
    if hostname and not _is_safe_target(hostname):
        return CheckResult("down", None, None, "Blocked: target resolves to a private/internal address")

    # Block non-http(s) schemes
    if parsed.scheme and parsed.scheme.lower() not in ("http", "https"):
        return CheckResult("down", None, None, "Blocked: only http/https schemes allowed")

    start = datetime.now(timezone.utc)
    ssl_expires_at = None
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=follow_redirects,
            verify=True,
        ) as client:
            if method == "HEAD":
                resp = await client.head(url, headers=headers, auth=auth)
            elif method == "POST":
                resp = await client.post(url, headers=headers, auth=auth)
            else:
                resp = await client.get(url, headers=headers, auth=auth)

            if url.lower().startswith("https") and check_ssl:
                try:
                    ssl_expires_at = _extract_ssl_expiry(url)
                except Exception:
                    ssl_expires_at = None

        elapsed_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        ok = resp.status_code in up_codes
        return CheckResult(
            status="up" if ok else "down",
            status_code=resp.status_code,
            response_time=round(elapsed_ms, 1),
            error=None if ok else f"HTTP {resp.status_code}",
            ssl_expires_at=ssl_expires_at,
        )
    except httpx.TimeoutException:
        elapsed_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        return CheckResult("down", None, round(elapsed_ms, 1), "Timeout")
    except Exception as e:  # noqa: BLE001
        elapsed_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        return CheckResult("down", None, round(elapsed_ms, 1), f"{type(e).__name__}: {e}")


def _extract_ssl_expiry(url: str) -> datetime | None:
    """Fetch the server cert and return its notAfter (UTC). Uses the ssl lib."""
    import ssl
    import time as _time
    import calendar
    from socket import create_connection
    from urllib.parse import urlparse

    host = urlparse(url).hostname
    port = urlparse(url).port or 443
    if not host:
        return None
    ctx = ssl.create_default_context()
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.maximum_version = ssl.TLSVersion.TLSv1_3
    with create_connection((host, port), timeout=TIMEOUT) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            cert = ssock.getpeercert()
    # cert['notAfter'] is e.g. "Jun 12 23:59:59 2027 GMT"
    ts = _time.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
    # calendar.timegm interprets the struct_time as UTC (unlike time.mktime which uses local timezone)
    return datetime.fromtimestamp(calendar.timegm(ts), tz=timezone.utc)


def humanize_ms(ms: float | None) -> str:
    if ms is None:
        return "—"
    return f"{math.ceil(ms)}ms" if ms < 1000 else f"{ms/1000:.1f}s"
