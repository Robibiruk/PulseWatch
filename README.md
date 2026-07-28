# PulseWatch

> PulseWatch is an open-source incident monitoring platform that helps developers detect downtime, diagnose failures, and communicate service health through automated alerts and public status pages. Telegram-first, with AI-assisted incident explanations.

PulseWatch is a full-stack monitoring platform:

- **Backend** — FastAPI (Python) continuous monitoring engine, scheduler/worker (with safe multi-replica claim locking), notification dispatcher, Telegram bot (long-polling), and REST API.
- **Frontend** — React + Vite + TypeScript single-page app (dashboard, monitor detail, incidents, settings, public status page).

It is designed to run cheaply (or free) on platforms like Render, Railway, Fly.io, or any VPS, and can also run entirely on your laptop for local development.

**Maturity:** this is an MVP-grade, portfolio-strong foundation. Core monitoring, alerts, status pages, and incident history are real and working. Production hardening (separate worker/bot services, Alembic migrations, a queue for 1k+ monitors, escalation, ack workflows) is planned — see [Project Status / Roadmap](#project-status--roadmap).

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Architecture](#architecture)
3. [Project Layout](#project-layout)
4. [Prerequisites](#prerequisites)
5. [Backend Setup](#backend-setup)
6. [Frontend Setup](#frontend-setup)
7. [Running Locally (Dev)](#running-locally-dev)
8. [Environment Variables](#environment-variables)
9. [Database & Migrations](#database--migrations)
10. [Telegram Bot & Account Linking](#telegram-bot--account-linking)
11. [Notifications](#notifications)
12. [Monitor Types & Configuration](#monitor-types--configuration)
13. [Public Status Page](#public-status-page)
14. [Production Deployment](#production-deployment)
15. [API Reference (summary)](#api-reference-summary)
16. [Troubleshooting](#troubleshooting)
17. [Project Status / Roadmap](#project-status--roadmap)

---

## Feature Overview

- **HTTP/HTTPS monitors** with configurable interval (1 / 5 / 10 / 30 min), request timeout, follow-redirects, IP version, HTTP method (GET/HEAD/POST), basic & bearer auth, and custom "up" status-code buckets (2xx / 3xx / 4xx / 5xx).
- **Heartbeat (push) monitors** — your service pings a unique token URL to prove it is alive; silence triggers a down alert.
- **SSL certificate checks** — detect SSL errors and warn before the certificate expires (`SSL_WARN_DAYS`).
- **Domain expiry reminders** — warn before a domain registration lapses.
- **Incident tracking** — automatic open/resolve of outages with duration, HTTP status, error reason, and an optional AI-generated plain-English explanation (OpenRouter).
- **Per-monitor configuration UI** — UptimeRobot-style editor with free-tier fields functional and paid-tier fields shown as locked "Upgrade" badges.
- **Per-monitor Pause / Resume** and **Edit** actions directly on the dashboard.
- **Multi-channel alerts** — Telegram, Email (Resend), Discord webhook, Slack webhook, generic webhook (Zapier/Make/custom).
- **Per-user pause** of all alerts, and per-user channel preferences.
- **Telegram bot** — long-polling bot that sends downtime/recovery pings and responds to a small set of commands (`/start`, `/status`, `/help`, `/about`, plus helpers).
- **Public status page** — shareable, auth-free live board per account (`/status/<userId>`).
- **Auth** — email/password registration & login with JWT (python-jose), bcrypt password hashing.

---

## Architecture

**Dev (single process):** the FastAPI app's lifespan starts the worker loop and the
Telegram bot in-process. Great for local work.

```mermaid
graph TD
    A[React SPA<br/>Vite + TS] -->|REST + JWT| B[FastAPI App<br/>main:app]
    B -->|lifespan, dev only| C[Worker Loop<br/>scheduler]
    B -->|lifespan, dev only| D[Telegram Bot<br/>long-poll]
    C --> E[check_site]
    E --> F[(Incidents + Alerts)]
    D -->|/start token| G[/auth/telegram/connect/]
    F --> H[Notifications<br/>Telegram / Email / Discord / Slack / Webhook]
```

**Prod (recommended): separate services.** Render (or any PaaS) runs the API, the
worker, and the bot as independent services against one Postgres. This scales the
check engine horizontally without duplicating alerts.

```mermaid
graph TD
    subgraph Services
        API[pulsewatch-api]
        Worker[pulsewatch-worker]
        Bot[pulsewatch-bot]
    end
    DB[(PostgreSQL / Neon)]
    API --> DB
    Worker -->|claims monitors<br/>SELECT FOR UPDATE SKIP LOCKED| DB
    Bot --> DB
    API -->|serves dashboard +<br/>public status pages| Users((Users))
    Worker --> Notify[Notification Dispatcher]
    Bot --> Notify
```

**Telegram account-linking flow** — documented as a sequence diagram because the
linking flow (username-vs-numeric-id deep link) has caused regressions before:

```mermaid
sequenceDiagram
    participant U as User (SPA)
    participant API as FastAPI
    participant TG as Telegram Bot API
    participant B as User's Telegram App

    U->>API: GET /auth/telegram/link
    API->>TG: getMe (resolve bot username)
    API-->>U: https://t.me/<BotUsername>?start=<token>
    U->>B: Opens deep link, taps Start
    B->>API: POST /auth/telegram/connect {token, chat_id}
    API-->>U: Settings flips to "Connected"
```

**Worker claim-lock / lease state machine** — how a monitor moves through the
distributed scheduler (crash recovery via `SKIP LOCKED` + lease expiry):

```mermaid
stateDiagram-v2
    [*] --> Idle: created
    Idle --> Claimed: worker claims<br/>(SKIP LOCKED + lease)
    Claimed --> Checking: probe begins
    Checking --> Released: check done / ok
    Checking --> Incident: down detected
    Incident --> Released: resolved
    Released --> Idle: claim cleared
    Claimed --> Idle: lease expired<br/>(crashed worker)
    note right of Claimed
        claimed_until + claim_token
        written atomically.
        Other replicas SKIP LOCKED
        rows another worker holds.
    end note
```

**Duplicate-check prevention.** The scheduler claims each due monitor with a
short lease (`claimed_until` + a random `claim_token`) before probing. On Postgres
it uses `SELECT … FOR UPDATE SKIP LOCKED` so concurrent worker replicas never pick
the same monitor; on SQLite (dev) it falls back to the lease. The claim is released
when the check finishes, so a crashed worker's monitors become claimable again after
the lease expires. **This means you can run 2+ worker replicas safely** — no
double-checks, no double-alerts.

Key backend modules:

| File | Responsibility |
|------|----------------|
| `main.py` | FastAPI app, CORS, lifespan: starts worker + Telegram bot (dev) |
| `worker.py` | Continuous scheduler — claims due monitors (lease + `SKIP LOCKED`), runs `check_site`, records incidents, dispatches alerts |
| `checker.py` | `check_site()` — performs the HTTP/HTTPS probe honoring all monitor options; SSL/domain checks |
| `telegram_bot.py` | Long-polling Telegram bot; clears webhooks on startup; handles commands; links accounts |
| `notifications.py` | Dispatches alerts to enabled channels (Telegram/Email/Discord/Slack/Webhook) |
| `emailer.py` | Branded HTML email templates (incident, signup, login, checkin) |
| `routers/notifications.py` | Test-notification endpoint so users can verify their channels |
| `ai_explain.py` | Optional AI plain-English incident explanations via OpenRouter |
| `models.py` | SQLAlchemy 2.0 async ORM models (User, Monitor, Incident, Check, Heartbeat, StatusPage) |
| `schemas.py` | Pydantic request/response schemas |
| `database.py` | Engine/session setup + additive column migrations |
| `config.py` | `pydantic-settings` config loaded from environment / `.env` |
| `routers/` | API route groups (`auth`, `monitors`, `status`, `telegram`, `heartbeat`, `statuspage`, `notifications`) |

---

## Project Layout

```
PulseWatch/
├── backend/
│   ├── main.py
│   ├── worker.py
│   ├── checker.py
│   ├── telegram_bot.py
│   ├── notifications.py
│   ├── ai_explain.py
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   ├── config.py
│   ├── requirements.txt
│   ├── .env                      # (you create this; see Environment Variables)
│   └── routers/
│       ├── auth.py
│       ├── monitors.py
│       ├── status.py
│       ├── telegram.py
│       ├── heartbeat.py
│       └── statuspage.py
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── .env                      # optional: VITE_API_BASE
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── auth.tsx
│   │   ├── styles.css
│   │   ├── components/           # Layout, Icon, NewMonitorWizard, MonitorEditor
│   │   └── pages/               # Landing, Login, Dashboard, MonitorDetail,
│   │                              #   Incidents, Settings, PublicStatus
│   └── dist/                    # production build output (generated)
└── README.md
```

---

## Prerequisites

- **Python** 3.11+ (the bot/worker use async; 3.11+ recommended).
- **Node.js** 18+ and npm (for the frontend).
- A **PostgreSQL** database (e.g. Neon, Supabase, Render Postgres, or any Postgres). For local dev you can use SQLite (see below).
- (Optional) a **Telegram bot token** from [@BotFather](https://t.me/BotFather).
- (Optional) a **Resend** API key for email alerts.
- (Optional) an **OpenRouter** API key for AI incident explanations.

---

## Backend Setup

```bash
# from repo root
cd backend

# create & activate a virtualenv (choose one)
python -m venv .venv
# Windows (git-bash / MSYS):
.venv/Scripts/activate
# macOS / Linux:
# source .venv/bin/activate

# install dependencies
pip install -r requirements.txt
```

### Database

The backend reads `DATABASE_URL`.

- **PostgreSQL (recommended / production):**
  ```
  DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME
  ```
- **SQLite (zero-config local dev):**
  ```
  DATABASE_URL=sqlite+aiosqlite:///./pulsewatch.db
  ```
  Tables and any additive column migrations are created automatically on startup (`init_db()` + `_migrate_columns()`).

### Configuration

Create `backend/.env` (or export the variables in your shell). See [Environment Variables](#environment-variables) for the full list. Minimal example:

```ini
# backend/.env
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
SECRET_KEY=change-me-to-a-long-random-string
# Telegram (optional)
TELEGRAM_BOT_TOKEN=123456:ABC-your-token
```

> **Note:** The backend auto-loads `backend/.env` via pydantic-settings. Do **not** commit your real `.env`.

---

## Frontend Setup

```bash
# from repo root
cd frontend

npm install

# optional: point the SPA at your backend
# frontend/.env
VITE_API_BASE=http://localhost:8000
# (defaults to http://localhost:8000 if unset)
```

> **Note:** The frontend only needs `VITE_API_BASE` at build time. In production, build once with the correct value (or set it before `npm run build`).

---

## Running Locally (Dev)

You need **two** processes: the backend API and the frontend dev server.

### Terminal 1 — Backend

```bash
cd backend
.venv/Scripts/activate        # or: source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000` and the interactive docs at `http://localhost:8000/docs`.

- The **worker** (scheduler) starts automatically in the app lifespan unless `NO_WORKER=true`.
- The **Telegram bot** starts automatically if `TELEGRAM_BOT_TOKEN` is set and `NO_TELEGRAM_BOT` is not true.

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. Register an account, add a monitor, and watch it check.

### Quick smoke test (backend only)

```bash
cd backend
.venv/Scripts/activate
python - <<'PY'
import asyncio, models, database
from routers import monitors
# ... or just hit http://localhost:8000/health
PY
curl http://localhost:8000/health
# -> {"status":"ok","service":"pulsewatch"}
```

---

## Environment Variables

All backend config is loaded by `config.py` (pydantic-settings) from the environment or `backend/.env`.

### Core
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (required) | SQLAlchemy async URL. `postgresql+asyncpg://...` or `sqlite+aiosqlite:///./file.db` |
| `SECRET_KEY` | `dev-insecure-change-me` | JWT signing secret — **set a long random value in production** |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | JWT lifetime (24h) |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |

### Worker / Scheduler
| Variable | Default | Description |
|----------|---------|-------------|
| `POLL_INTERVAL` | `15` | Base scheduler tick (seconds) |
| `WORKER_CONCURRENCY` | `20` | Max concurrent checks |
| `NO_WORKER` | `False` | Set `true` to disable the built-in scheduler (e.g. when GitHub Actions / an external worker owns checks) |
| `FAILURE_THRESHOLD` | `3` | Consecutive failures before an incident is opened |
| `CONFIRMATION_DELAY` | `10` | Seconds to confirm a recovery before closing an incident |
| `SSL_WARN_DAYS` | `14` | Days before expiry to start warning about SSL/domain |

### Telegram
| Variable | Default | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | `""` | Bot token from @BotFather. Enables the bot + Telegram alerts |
| `TELEGRAM_CHAT_ID` | `""` | Optional global fallback chat id |
| `NO_TELEGRAM_BOT` | `False` | Set `true` to disable the bot poller (alerts still work if a chat is linked) |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Public base URL the bot uses to call back `/auth/telegram/connect` during account linking |

### Email (Resend)
| Variable | Default | Description |
|----------|---------|-------------|
| `RESEND_API_KEY` | `""` | Resend API key |
| `ALERT_FROM_EMAIL` | `alerts@yourdomain.com` | From address (must be verified in Resend) |
| `ALERT_TO_EMAIL` | `""` | Global fallback destination |

### Other alert channels (global fallback)
| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_WEBHOOK_URL` | `""` | Discord incoming webhook |
| `SLACK_WEBHOOK_URL` | `""` | Slack incoming webhook |
| `GENERIC_WEBHOOK_URL` | `""` | Generic JSON webhook |

### AI explanations (optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | `""` | OpenRouter key for AI incident explanations |
| `OPENROUTER_MODEL` | `openai/gpt-oss-20b:free` | Model used |

### Frontend
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `http://localhost:8000` | Backend base URL the SPA calls |

---

## Database & Migrations

PulseWatch uses **additive, code-driven migrations** — there is no separate migration tool to run *for now*.

- On startup, `init_db()` creates all tables via SQLAlchemy metadata (`models.Base.metadata.create_all`).
- `_migrate_columns()` then ensures any newer columns exist on existing tables (ALTER TABLE ADD COLUMN when missing). This keeps existing deployments working after schema additions (e.g. the monitor-configuration columns, the worker-claim columns) without a manual step.

**Road to Alembic:** additive column additions are safe for an MVP, but they can't express renames, type changes, or data backfills, and they're not reviewable as versioned history. Before the project takes real customers, migrate to **Alembic** (with `alembic.autogenerate` off — hand-written migrations only). The current `_migrate_columns()` is the bridge: keep it until the first Alembic baseline is cut, then delete it.

To start completely fresh, point `DATABASE_URL` at a new/empty database (or delete the SQLite file) and restart the backend.

---

## Telegram Bot & Account Linking

The bot (`telegram_bot.py`) is a **long-polling** bot built directly on `httpx` (no `aiogram` dependency). It:

1. On startup, validates the token via `getMe`.
2. **Clears any existing webhook** (`deleteWebhook`) so long-polling actually receives updates (a left-over webhook is the most common cause of a "bot that does nothing").
3. Polls `getUpdates` and dispatches commands.

### Linking your account (so `/status` shows your monitors)

1. In the dashboard go to **Settings → Connect Telegram**.
2. The backend calls `GET /auth/telegram/link`, which:
   - generates a single-use `telegram_link_token` on your user row,
   - resolves the bot **username** via `getMe`, and
   - returns a valid deep link: `https://t.me/<BotUsername>?start=<token>`.
3. The frontend opens `tg://resolve?domain=<BotUsername>&start=<token>` (native app) with an `https://t.me/...` fallback, then polls for the link to complete.
4. You press **Start** in the bot. The bot receives `/start <token>`, POSTs `{token, chat_id}` to `POST /auth/telegram/connect`, and your chat is bound to your account.
5. Settings flips to **Connected** automatically.

> **Why not just `t.me/<bot_id>`?** Telegram deep links require the bot **username**, not the numeric id. Using the numeric id produced an invalid link that bounced to `telegram.org`. The current code resolves the real username via `getMe`.

### Bot commands
| Command | Behavior |
|---------|----------|
| `/start` | Welcome; if opened with a link token, links your account |
| `/status` | Lists your monitors with up/down state (requires linked account) |
| `/monitors` | Lists your monitors with URL + interval |
| `/incidents` | Recent outages/recoveries |
| `/help` | Lists available commands |
| `/about` | About PulseWatch |
| `/notifications` | Shows your active alert channels |
| `/settings` | Reminds you to manage settings on the web dashboard |
| `/pause` | Pauses all alerts for your account |
| `/resume` | Resumes alerts |

The bot is intentionally **notification-first**: heavy configuration (adding/editing monitors, channels, status page) is done on the web dashboard, not in chat.

---

## Notifications

When a monitor goes down (or recovers), `notifications.py` dispatches to every **enabled channel** for that user:

- **Telegram** — sent to the user's linked `telegram_chat_id` (requires the bot token + a linked account).
- **Email** — via Resend to the user's `alert_email` (or the global `ALERT_TO_EMAIL`).
- **Discord / Slack / Generic webhook** — posted as a JSON payload to the configured webhook URL.

Channel enablement is per-user (`enabled_channels`, a comma list like `telegram,email`), configurable in **Settings → Alert Channels**. A user can also **pause** all alerts (`/pause` or the Settings toggle); paused alerts are suppressed until resumed.

---

## Monitor Types & Configuration

### HTTP / HTTPS monitor
The core monitor. Configurable fields (free tier is fully functional):

| Field | Notes |
|-------|-------|
| Friendly name | Display name |
| URL | `http://` / `https://` endpoint |
| Monitor interval | 1 / 5 / 10 / 30 minutes |
| Tags | Comma-separated labels for organization |
| Request timeout | Seconds before the probe is considered failed |
| IP version | auto / IPv4 / IPv6 (stored; best-effort at the socket level) |
| Follow redirects | honor 3xx redirects or not |
| HTTP method | GET / HEAD / POST |
| Auth | none / basic (user+pass) / bearer (token) |
| Up status codes | which code buckets count as "up": 2xx, 3xx, 4xx, 5xx |
| SSL & domain checks | check SSL errors, SSL expiry reminders, domain expiry reminders |
| Notification note | Points to Settings channels ("no delay, no repeat") |

Paid-tier fields (shown locked with an "Upgrade" badge in the editor, matching the UptimeRobot-style UX): monitor location/region, slow-response (latency) alerts, custom request headers/body, meta fields.

### Heartbeat (push) monitor
A monitor of type `heartbeat` expects your service to call its unique token URL (`POST /heartbeat/<token>` or the token endpoint) on a schedule. If no heartbeat arrives within the interval, PulseWatch opens a "down" incident. Useful for cron jobs, workers, and background services that have no public HTTP endpoint to poll.

---

## Public Status Page

Each account can publish a shareable, **auth-free** status board:

- Configured in **Settings → Public Status Page** (title, description, theme: `neon` / `light` / `minimal`).
- Served by the backend at `GET /status/<userId>` (JSON) and rendered by the frontend **PublicStatus** page at `/status/<userId>`.
- Share `https://<your-domain>/status/<userId>` with your users.

---

## Production Deployment

PulseWatch is stateless apart from the database. For an MVP a single Render Web Service running the API + worker + bot is fine. To scale checks or get high availability, run **three services** against one Postgres (the worker's claim lock makes this safe — see [Architecture](#architecture)):

- `pulsewatch-api` — `uvicorn main:app` (serves dashboard API, public status pages, webhooks).
- `pulsewatch-worker` — `uvicorn main:app` with `NO_TELEGRAM_BOT=true` and the worker enabled (or a dedicated worker entrypoint). This is the only service that runs `check_site`.
- `pulsewatch-bot` — `uvicorn main:app` with `NO_WORKER=true` and `TELEGRAM_BOT_TOKEN` set, so only the bot runs here.

### Backend (example: Render Web Service)
1. Create a **Web Service** pointing at this repo, **Root Directory = `backend`**.
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add the environment variables from [Environment Variables](#environment-variables) (use your production `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `PUBLIC_BASE_URL`, etc.).
5. If you run checks from a separate worker (e.g. GitHub Actions or a second replica), set `NO_WORKER=true` on the web service and run the worker elsewhere; otherwise leave the worker enabled.

### Frontend (static host: Netlify / Vercel / Cloudflare Pages / Render Static)
1. Set `VITE_API_BASE` to your backend URL **before building**.
2. Build:
   ```bash
   cd frontend
   npm install
   npm run build      # outputs to frontend/dist
   ```
3. Deploy the `dist/` folder as a static site.
4. SPA routing: configure the host to rewrite all paths to `index.html` (so deep links like `/monitor/12` work).

> The backend and frontend can also be served from the same origin (e.g. have the backend serve `dist/`), but the simplest, most portable setup is backend-as-API + frontend-as-static with `CORS_ORIGINS` allowing the frontend domain.

### Production security checklist (do before sharing with others)
- [ ] Set `SECRET_KEY` to a long random value (the default `dev-insecure-change-me` is unsafe — it signs JWTs weakly). Generate: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- [ ] Set `CORS_ORIGINS` to your real frontend domain(s) — never `*` in production.
- [ ] Put the API behind a reverse proxy (Caddy/Nginx) or a host that rate-limits `/auth/token`, `/api/heartbeat/<token>`, and the generic webhook endpoint (no rate limiting is built in yet — a public heartbeat token could be abused).
- [ ] Use Postgres (Neon) in production; SQLite is dev-only. Keep `DATABASE_URL` secret.
- [ ] Rotate `TELEGRAM_BOT_TOKEN` and `RESEND_API_KEY` via your host's secret store, not committed files.
- [ ] For self-hosters: a `docker-compose up` image is planned (see Roadmap) — until then, the three-service Render setup above is the recommended path.

---

## API Reference (summary)

Base path: `/` (API). All authenticated routes require `Authorization: Bearer <jwt>`.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/token` | Login (form: `username`, `password`) → `{access_token}` |
| `POST` | `/auth/register` | Register a new account |
| `GET`  | `/auth/me` | Current user |
| `GET`  | `/auth/telegram/link` | Get a connect deep link + token |
| `POST` | `/auth/telegram/connect` | Bind chat id to the token |
| `POST` | `/auth/telegram/unlink` | Unlink Telegram |
| `GET`/`POST` | `/auth/telegram/channels` | Read/set alert channels |
| `POST` | `/auth/telegram/pause` · `/resume` | Pause/resume alerts |

### Monitors
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/monitors` | List monitors |
| `POST` | `/monitors` | Create monitor (full config) |
| `GET`  | `/monitors/<id>` | Monitor detail + recent incidents |
| `PATCH`| `/monitors/<id>` | Update monitor config |
| `DELETE`| `/monitors/<id>` | Delete monitor |
| `GET`  | `/monitors/summary` | Aggregate KPIs (up/down counts, etc.) |
| `GET`  | `/monitors/incidents` | Recent incidents |

### Status / Heartbeat / Status page
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/status/<userId>` | Public status board (JSON, no auth) |
| `POST` | `/api/heartbeat/create` | Create a heartbeat (push) monitor |
| `POST` | `/api/heartbeat/<token>` | Ping endpoint your service calls to stay "alive" |
| `GET`  | `/api/monitors/<id>/heartbeat-token` | Get a monitor's push token |
| `GET`/`POST` | `/status-page` | Read/save your public page config |

Full interactive docs (with request/response schemas) are available at `/docs` (Swagger UI) when the backend is running.

---

## Troubleshooting

**Bot does nothing when I send commands**
- Ensure the backend is running with `TELEGRAM_BOT_TOKEN` set and `NO_TELEGRAM_BOT` not true.
- On startup you should see:
  ```
  [telegram] bot authorized as @YourBot
  [telegram] cleared any existing webhook (switching to polling)
  [telegram] bot polling started
  ```
- A **left-over webhook** used to starve polling — the bot now clears it on startup. If commands still don't arrive, check there is no other process polling the same bot.
- Incoming commands are logged: `[telegram] <- /start from chat 123`.

**"Connect Telegram" opens telegram.org instead of the bot**
- This was caused by building the deep link from the numeric bot **id** instead of the **username**. Fixed: the link endpoint now resolves the username via `getMe` and returns `https://t.me/<BotUsername>?start=<token>`. Restart the backend after deploying the fix.

**CORS errors in the browser**
- Add your frontend origin to `CORS_ORIGINS` (comma-separated) and restart the backend.
- Confirm `VITE_API_BASE` in the frontend points at the backend URL you actually deployed.

**Database connection errors**
- Check `DATABASE_URL` (async driver!). Postgres needs `postgresql+asyncpg://`; SQLite needs `sqlite+aiosqlite:///`.
- For Neon/cloud Postgres, use the **pooled** connection string if provided.

**No alerts received**
- Telegram: account must be **linked** (Settings → Connect) and the bot token valid.
- Email: `RESEND_API_KEY` set and `ALERT_FROM_EMAIL` verified in Resend.
- Webhooks: confirm the URL is reachable and returns 2xx.

**Migrations / new columns missing**
- Restart the backend; `_migrate_columns()` adds missing columns automatically. For a totally fresh start, point at a new empty database.

---

## Project Status / Roadmap

PulseWatch is at **MVP-grade, portfolio-strong** maturity. The core is real and working: monitoring engine, incident state machine, SSL/domain checks, heartbeat (push) monitors, multi-channel notifications (Telegram/Email/Discord/Slack/webhook), signup/login/checkin emails, Telegram bot + account linking, public status pages, per-monitor configuration UI, branded incident emails, and AI incident explanations.

### Reliability work (highest priority — what separates a monitoring product from a dashboard)
- **Alembic migrations** — replace additive column migrations before taking real customers.
- **Durable job queue** (Redis/RQ or ARQ) — currently the worker is an in-process loop; a queue is needed to survive worker restarts without losing in-flight checks and to push past ~1k monitors.
- **Second-region confirmation** — optionally re-check a down signal from a different host/provider before alerting, to kill false positives.
- **Rate limiting** on `/auth/token`, `/api/heartbeat/<token>`, and webhook endpoints.

### Features (in approximate priority order)
- **Incident acknowledgement** + assignment (stop repeat-alert spam without resolving).
- **Maintenance windows** — pause alerts for a monitor on a schedule (deploy windows).
- **Escalation policies** — if unacked after N minutes, notify a second channel/person.
- **Monitor tags/groups** — group Production / Staging.
- **Historical uptime graphs / 30–90 day SLA charts** (the `checks` table already records raw data).
- **Runbook notes** per monitor, embedded in alerts.
- **Provider-native auto-remediation** (Render/Railway/Fly restart on N consecutive failures) + webhook-triggered remediation.
- More channels (Microsoft Teams, Pushover, PagerDuty).
- **Docker / docker-compose** one-command self-host.
- Regions/multi-location checks.
- Team/collaborator accounts.

### Scaling roadmap
- **MVP:** ≤100 monitors, 1 worker, 1-min checks — ships today.
- **Beta:** ~1k monitors, Redis-backed queue, multiple worker replicas (safe thanks to the claim lock).
- **Production:** 10k+ monitors, distributed workers across regions, queue + backpressure.

> Deliberately deferred for v1: teams/billing/regions/Slack-or-PagerDuty-native/Kubernetes. The wedge is **Telegram-first alerts + AI incident explanations for solo devs and small teams**, not feature-parity with Uptime Kuma.

---

## License

See repository license file. (Add your preferred license here.)
