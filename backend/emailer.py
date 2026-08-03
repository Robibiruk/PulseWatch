"""PulseWatch transactional emails (Resend).

Branded HTML templates for:
  - incident DOWN
  - incident RESOLVED
  - signup (welcome)
  - login (new sign-in notice)
  - checkin (periodic wellbeing digest of your monitors)

All senders route through Resend when RESEND_API_KEY is configured. If it is
not, the call is a no-op (dev mode) so the app runs without email credentials.

This module is deliberately framework-free: it builds (subject, html, text)
tuples so callers decide how to send (Resend, console, tests).
"""
from datetime import datetime, timezone
from html import escape as _html_escape


# --- small helpers ---
def _e(val: str | None) -> str:
    """HTML-escape a value for safe interpolation into email templates."""
    return _html_escape(str(val)) if val else ""

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _fmt_dt(dt) -> str:
    if dt is None:
        return "—"
    if getattr(dt, "tzinfo", None) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M UTC")


def _fmt_dur(minutes) -> str:
    if not minutes:
        return "—"
    if minutes < 60:
        return f"{minutes:.0f} min"
    if minutes < 1440:
        return f"{minutes / 60:.1f} h"
    return f"{minutes / 1440:.1f} d"


# Branded wrapper: keeps every email visually consistent.
def _wrap(title: str, accent: str, body_html: str, preheader: str = "") -> str:
    return f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;background:#0b0f1a;color:#e6e9f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
  <div style="font:600 20px/1.2 -apple-system,Segoe UI,Roboto;letter-spacing:.5px;">
    <span style="color:#22d3ee;">▰</span> Pulse<span style="color:#22d3ee;">Watch</span>
  </div>
  <div style="margin:18px 0 8px;font-size:13px;color:#8b93a7;">{preheader}</div>
  <div style="background:#121829;border:1px solid #1f2740;border-radius:14px;overflow:hidden;">
    <div style="height:6px;background:{accent};"></div>
    <div style="padding:22px 22px 8px;">
      <h1 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#fff;">{title}</h1>
      {body_html}
    </div>
  </div>
  <div style="margin-top:16px;font-size:12px;color:#6b7280;text-align:center;">
    PulseWatch — free uptime monitoring. You received this because you have a
    PulseWatch account. Alerts can be managed in your dashboard.
  </div>
</div>
</body></html>"""


import re

def _text_from_html(html: str) -> str:
    import re as _re
    t = re.sub(r"<br\s*/?>", "\n", html)
    t = re.sub(r"</?(div|h1|h2|p|li|tr|table)[^>]*>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    # collapse repeated newlines (from nested <div>/<p>/<tr>...</tr>) down to a max
    t = re.sub(r"\n{3,}", "\n\n", t)
    # drop pure whitespace lines so Telegram/email plaintext doesn't have huge vertical gaps
    t = "\n".join(line for line in re.split(r"\n", t) if line.strip())
    return t.strip()


# --- incident DOWN ---------------------------------------------------------

def incident_down(user_name: str, monitor_name: str, url: str,
                  status_code, reason: str, latency_ms, since_dt,
                  ai_note: str | None = None) -> tuple[str, str, str]:
    # HTML-escape all dynamic values to prevent injection
    un = _e(user_name or "there")
    mn = _e(monitor_name)
    eu = _e(url)
    rsn = _e(reason or (f"HTTP {status_code}" if status_code else "No response"))
    title = "🚨 Monitor down — " + monitor_name
    latency = f"{int(latency_ms)} ms" if latency_ms is not None else "—"
    ai_block = ""
    if ai_note:
        ai_block = (
            '<div style="margin-top:14px;padding:12px 14px;background:#0e1726;'
            'border-left:3px solid #22d3ee;border-radius:8px;font-size:13px;color:#b9c2d6;">'
            f"<strong style='color:#22d3ee;'>🤖 AI analysis:</strong> {_e(ai_note)}</div>"
        )
    body = f"""
    <p style="margin:0 0 12px;color:#c7cede;">Hi {un},</p>
    <p style="margin:0 0 14px;color:#c7cede;">One of your monitors is <strong style="color:#ff6b6b;">down</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#8b93a7;">Service</td><td style="padding:6px 0;color:#fff;font-weight:600;">{mn}</td></tr>
      <tr><td style="padding:6px 0;color:#8b93a7;">URL</td><td style="padding:6px 0;color:#9fd8ff;word-break:break-all;">{eu}</td></tr>
      <tr><td style="padding:6px 0;color:#8b93a7;">Status</td><td style="padding:6px 0;color:#ff6b6b;">{status_code or '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#8b93a7;">Reason</td><td style="padding:6px 0;color:#fff;">{rsn}</td></tr>
      <tr><td style="padding:6px 0;color:#8b93a7;">Latency</td><td style="padding:6px 0;color:#fff;">{latency}</td></tr>
      <tr><td style="padding:6px 0;color:#8b93a7;">Since</td><td style="padding:6px 0;color:#fff;">{_fmt_dt(since_dt)}</td></tr>
    </table>
    {ai_block}
    <p style="margin:16px 0 4px;">
      <a href="{eu}" style="display:inline-block;background:#22d3ee;color:#04121a;text-decoration:none;
         font-weight:700;border-radius:8px;padding:10px 16px;font-size:13px;">Open monitor</a>
    </p>
    """
    html = _wrap(title, "#ff6b6b", body, f"{monitor_name} is down — {reason}")
    return (title, html, _text_from_html(html))


# --- incident RESOLVED -----------------------------------------------------

def incident_resolved(user_name: str, monitor_name: str, url: str,
                       downtime_minutes) -> tuple[str, str, str]:
    title = "✅ Monitor recovered — " + monitor_name
    body = f"""
    <p style="margin:0 0 12px;color:#c7cede;">Hi {user_name or 'there'},</p>
    <p style="margin:0 0 14px;color:#c7cede;"><strong style="color:#34d399;">Good news</strong> — {monitor_name} is back up.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#8b93a7;">Service</td><td style="padding:6px 0;color:#fff;font-weight:600;">{monitor_name}</td></tr>
      <tr><td style="padding:6px 0;color:#8b93a7;">URL</td><td style="padding:6px 0;color:#9fd8ff;word-break:break-all;">{url}</td></tr>
      <tr><td style="padding:6px 0;color:#8b93a7;">Downtime</td><td style="padding:6px 0;color:#34d399;font-weight:600;">{_fmt_dur(downtime_minutes)}</td></tr>
    </table>
    <p style="margin:16px 0 4px;">
      <a href="{url}" style="display:inline-block;background:#34d399;color:#04210f;text-decoration:none;
         font-weight:700;border-radius:8px;padding:10px 16px;font-size:13px;">Open monitor</a>
    </p>
    """
    html = _wrap(title, "#34d399", body, f"{monitor_name} recovered after {_fmt_dur(downtime_minutes)}")
    return (title, html, _text_from_html(html))


# --- signup (welcome) ------------------------------------------------------

def signup_welcome(user_name: str, dashboard_url: str = "https://pulsewatch.app/dashboard") -> tuple[str, str, str]:
    title = "Welcome to PulseWatch 💓"
    body = f"""
    <p style="margin:0 0 12px;color:#c7cede;">Hi {user_name or 'there'},</p>
    <p style="margin:0 0 14px;color:#c7cede;">Your PulseWatch account is ready. Start monitoring your sites and APIs in under a minute — and get pinged on Telegram the moment something breaks.</p>
    <ul style="margin:0 0 14px;padding-left:18px;color:#c7cede;font-size:14px;line-height:1.7;">
      <li>Add a website, API, or keyword monitor</li>
      <li>Connect Telegram for instant alerts</li>
      <li>Share a public status page with your users</li>
    </ul>
    <p style="margin:16px 0 4px;">
      <a href="{dashboard_url}" style="display:inline-block;background:#22d3ee;color:#04121a;text-decoration:none;
         font-weight:700;border-radius:8px;padding:10px 16px;font-size:13px;">Go to dashboard</a>
    </p>
    """
    html = _wrap(title, "#22d3ee", body, "Your free uptime monitor is ready")
    return (title, html, _text_from_html(html))


# --- login (new sign-in notice) -------------------------------------------

def login_notice(user_name: str, when_dt=None, ip: str | None = None) -> tuple[str, str, str]:
    when = _fmt_dt(when_dt or _now())
    meta = f" at {ip}" if ip else ""
    title = "New sign-in to PulseWatch"
    body = f"""
    <p style="margin:0 0 12px;color:#c7cede;">Hi {user_name or 'there'},</p>
    <p style="margin:0 0 14px;color:#c7cede;">We noticed a new sign-in to your PulseWatch account.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#8b93a7;">When</td><td style="padding:6px 0;color:#fff;">{when}{meta}</td></tr>
    </table>
    <p style="margin:14px 0 4px;color:#8b93a7;font-size:13px;">If this was you, no action is needed. If not, reset your password and revoke sessions from your dashboard.</p>
    """
    html = _wrap(title, "#a78bfa", body, f"New sign-in {when}{meta}")
    return (title, html, _text_from_html(html))


# --- alerts PAUSED / RESUMED (account-level) ------------------------------

def alerts_paused(user_name: str) -> tuple[str, str, str]:
    title = "⏸ Monitoring alerts paused"
    body = f"""
    <p style="margin:0 0 12px;color:#c7cede;">Hi {user_name or 'there'},</p>
    <p style="margin:0 0 14px;color:#c7cede;">All PulseWatch alerts for your account are now <strong style="color:#fbbf24;">paused</strong>.</p>
    <p style="margin:0 0 14px;color:#c7cede;">You won't receive downtime, recovery, or heartbeat notifications until you resume them. Your monitors keep running — we're just staying quiet.</p>
    <p style="margin:14px 0 4px;color:#8b93a7;font-size:13px;">Resume anytime from Settings → Alert Channels or by sending /resume in Telegram.</p>
    """
    html = _wrap(title, "#fbbf24", body, "Your PulseWatch alerts are paused")
    return (title, html, _text_from_html(html))


def alerts_resumed(user_name: str) -> tuple[str, str, str]:
    title = "▶️ Monitoring alerts resumed"
    body = f"""
    <p style="margin:0 0 12px;color:#c7cede;">Hi {user_name or 'there'},</p>
    <p style="margin:0 0 14px;color:#c7cede;">Your PulseWatch alerts are <strong style="color:#34d399;">active again</strong>.</p>
    <p style="margin:0 0 14px;color:#c7cede;">We'll notify you about downtimes, recoveries, and heartbeat misses as they happen.</p>
    """
    html = _wrap(title, "#34d399", body, "Your PulseWatch alerts are active again")
    return (title, html, _text_from_html(html))


# --- MONITOR stopped (paused) / resumed ------------------------------------

def monitor_paused(user_name: str, monitor_name: str, url: str) -> tuple[str, str, str]:
    title = "⏸ Monitor stopped — " + monitor_name
    body = f"""
    <p style="margin:0 0 12px;color:#c7cede;">Hi {user_name or 'there'},</p>
    <p style="margin:0 0 14px;color:#c7cede;">You <strong style="color:#fbbf24;">stopped</strong> the monitor <strong style="color:#fff;">{monitor_name}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#8b93a7;">Service</td><td style="padding:6px 0;color:#fff;font-weight:600;">{monitor_name}</td></tr>
      <tr><td style="padding:6px 0;color:#8b93a7;">URL</td><td style="padding:6px 0;color:#9fd8ff;word-break:break-all;">{url}</td></tr>
    </table>
    <p style="margin:14px 0 4px;color:#8b93a7;font-size:13px;">It will no longer be checked and won't trigger alerts until resumed.</p>
    """
    html = _wrap(title, "#fbbf24", body, f"{monitor_name} stopped")
    return (title, html, _text_from_html(html))


def monitor_resumed(user_name: str, monitor_name: str, url: str) -> tuple[str, str, str]:
    title = "▶️ Monitor resumed — " + monitor_name
    body = f"""
    <p style="margin:0 0 12px;color:#c7cede;">Hi {user_name or 'there'},</p>
    <p style="margin:0 0 14px;color:#c7cede;">You <strong style="color:#34d399;">resumed</strong> the monitor <strong style="color:#fff;">{monitor_name}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#8b93a7;">Service</td><td style="padding:6px 0;color:#fff;font-weight:600;">{monitor_name}</td></tr>
      <tr><td style="padding:6px 0;color:#8b93a7;">URL</td><td style="padding:6px 0;color:#9fd8ff;word-break:break-all;">{url}</td></tr>
    </table>
    <p style="margin:14px 0 4px;color:#8b93a7;font-size:13px;">Checks are active again and alerts will fire on failure.</p>
    """
    html = _wrap(title, "#34d399", body, f"{monitor_name} resumed")
    return (title, html, _text_from_html(html))


# --- checkin (periodic digest) --------------------------------------------

def checkin(user_name: str, monitors: list, base_url: str = "https://pulsewatch.app/dashboard") -> tuple[str, str, str]:
    """monitors: list of dicts {name, url, status, last_checked_dt, response_time_ms}"""
    up = [m for m in monitors if m.get("status") == "up"]
    down = [m for m in monitors if m.get("status") == "down"]
    if down:
        headline = f"{len(down)} of your {len(monitors)} monitors need attention"
        accent = "#ff6b6b"
    elif not monitors:
        headline = "You have no monitors set up yet"
        accent = "#22d3ee"
    else:
        headline = f"All {len(monitors)} monitors are operational"
        accent = "#34d399"

    rows = ""
    for m in monitors:
        color = "#34d399" if m.get("status") == "up" else "#ff6b6b"
        label = "Operational" if m.get("status") == "up" else "Down"
        rt = f"{int(m['response_time_ms'])} ms" if m.get("response_time_ms") is not None else "—"
        rows += (
            "<tr>"
            f'<td style="padding:8px 0;color:#fff;font-weight:600;">{m.get("name")}</td>'
            f'<td style="padding:8px 0;color:{color};">{label}</td>'
            f'<td style="padding:8px 0;color:#8b93a7;text-align:right;">{rt}</td>'
            "</tr>"
        )
    if not rows:
        rows = '<tr><td colspan="3" style="padding:8px 0;color:#8b93a7;">Add your first monitor from the dashboard.</td></tr>'

    body = f"""
    <p style="margin:0 0 12px;color:#c7cede;">Hi {user_name or 'there'},</p>
    <p style="margin:0 0 14px;color:#c7cede;font-size:15px;font-weight:600;color:#fff;">{headline}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr style="color:#8b93a7;font-size:12px;">
        <td style="padding:4px 0;">Monitor</td><td style="padding:4px 0;">Status</td><td style="padding:4px 0;text-align:right;">Latency</td>
      </tr>
      {rows}
    </table>
    <p style="margin:16px 0 4px;">
      <a href="{base_url}" style="display:inline-block;background:#22d3ee;color:#04121a;text-decoration:none;
         font-weight:700;border-radius:8px;padding:10px 16px;font-size:13px;">Open dashboard</a>
    </p>
    """
    html = _wrap("📡 Your PulseWatch check-in", accent, body, headline)
    return ("📡 PulseWatch check-in", html, _text_from_html(html))
