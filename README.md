# ❤️ PulseWatch

> A free, developer-first uptime monitoring platform that keeps websites alive by
> continuously watching them — and explains *why* they broke with an AI incident analysis.

Built for **$0/month** by combining free tiers the way a distributed-systems engineer would:

| Component        | Free choice                                   |
|------------------|-----------------------------------------------|
| Frontend         | Vercel (React + Vite + TS)                    |
| API              | Render (FastAPI, can sleep)                   |
| Database         | Neon PostgreSQL (always available)            |
| Worker/scheduler | **GitHub Actions** (the "always-awake" trick) |
| Notifications    | Telegram (primary) + Resend email (secondary) |
| AI explanations  | OpenRouter (deepseek-r1:free)                 |

The key insight: **the monitoring worker does not live on the API server.** If Render
crashes, Render can't tell you it crashed. The worker runs on GitHub Actions every
minute, so the monitor stays alive even when parts of the system fail.

---

## How it works

```
Users
  │
React Dashboard (Vercel)  ──  FastAPI API (Render)  ──  PostgreSQL (Neon)
                                      │
                            GitHub Actions worker (every 1 min)
                                      │
                            monitor.py → checks due sites → saves → alerts
```

1. You add a monitor (`name`, `url`, `interval`) via the dashboard. It is saved to Neon
   with a `next_check` timestamp.
2. Every minute, GitHub Actions wakes up and runs `backend/worker_runner.py`.
3. The worker finds all monitors where `next_check <= now()`, probes each URL, stores a
   `Check`, and reschedules `next_check = now + interval`.
4. **Anti-false-alarm logic:** a single failed check does *not* alert. Only after
   `FAILURE_THRESHOLD` (default 3) consecutive failures does it open an `Incident` and
   fire a Telegram alert. A success while an incident is open resolves it and fires a
   recovery alert.
5. Each opened incident gets an **AI Incident Explanation** (rule-based fallback if no
   OpenRouter key is set) describing the likely cause and typical recovery time.

---

## Features

- 🔐 Email/password auth (JWT) — multi-user.
- 📊 Dashboard with per-monitor status, last-check, and a last-24h uptime bar.
- 🔎 Monitor detail: recent checks, incidents, and the AI analysis for the current outage.
- 🌐 **Public status page** at `/status/{ownerId}` — no auth, embed it anywhere.
- 🤖 AI Incident Explanation (OpenRouter, graceful rule-based fallback).
- 📲 Telegram + email alerts with no false alarms.

---

## Local development (no cloud needed)

### Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # edit secrets (or leave Telegram blank for stdout fallback)
# For local DB, point DATABASE_URL at SQLite:
#   DATABASE_URL=sqlite+aiosqlite:///./pulsewatch.db
uvicorn main:app --reload       # http://localhost:8000  (docs at /docs)
```
Run the worker loop locally (instead of GitHub Actions):
```bash
python worker_runner.py --serve
```
Verify everything works against SQLite without any cloud:
```bash
python smoke_test.py            # exercises auth, CRUD, worker state machine, status page
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
cp .env.example .env            # set VITE_API_BASE=http://localhost:8000
npm run dev                     # http://localhost:5173
```

---

## Deploy ($0)

### 1. Database — Neon
- Create a project at https://neon.tech → copy the **pooled** connection string.
- Add `?sslmode=require` if not present. This is your `DATABASE_URL`.

### 2. API — Render (can sleep)
- New **Web Service**, connect this repo, set *Root Directory* = `backend`.
- Build: `pip install -r requirements.txt` · Start: `bash start.sh`.
- Add env vars from `.env.example` (DATABASE_URL, SECRET_KEY, CORS_ORIGINS, etc).
- Note the URL: `https://pulsewatch-api.onrender.com`.

### 3. Worker — GitHub Actions
- In repo **Settings → Secrets and variables → Actions**, add the same `DATABASE_URL`,
  `SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `OPENROUTER_API_KEY`, etc.
- The workflow `.github/workflows/monitor.yml` already runs every minute. It works as soon
  as the secrets exist. You can also trigger it manually from the Actions tab.

### 4. Frontend — Vercel
- Import the repo, set *Root Directory* = `frontend`, Framework = Vite.
- Add env `VITE_API_BASE=<your Render URL>`.
- `vercel.json` SPA rewrite is included so `/status/:id` and dashboard routes work.

### 5. Telegram alerts
- Message @BotFather → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN`.
- Message your bot, then get your chat id from @userinfobot → `TELEGRAM_CHAT_ID`.

### 6. Public status page
- Your user id is in the JWT / or returned by `GET /auth/me` (`id` field).
- Share `https://<your-vercel-app>/status/{ownerId}`.

---

## AI Incident Explanation

When an incident opens, PulseWatch calls OpenRouter (`OPENROUTER_API_KEY`) with a small
prompt describing the failure signal and returns a concise likely-cause analysis. If no key
is configured, it falls back to a built-in rule-based explanation keyed on the HTTP status
code / error type (502 gateway, 503 unavailable, 504 timeout, DNS/connect errors, etc.), so
the feature always works.

Model is configurable via `OPENROUTER_MODEL` (default `deepseek/deepseek-r1:free`).

---

## Scaling path

The free MVP handles ~100 sites on one worker. To scale:
- 10k sites → multiple workers + a Redis queue (replace the GitHub Action trigger with a
  queue consumer).
- Dedicated VPS workers. The code architecture (workers read `due` monitors, write `checks`,
  open/close `incidents`) stays the same — only the scheduler changes.

---

## Project layout
```
.github/workflows/monitor.yml   # the free always-awake worker
backend/
  main.py                       # FastAPI app
  routers/{auth,monitors,status}.py
  worker.py                     # the anti-false-alarm state machine
  worker_runner.py              # entry point (used by GHA + --serve)
  checker.py                    # async HTTP probe
  notifications.py              # Telegram + Resend (+ stdout fallback)
  ai_explain.py                 # OpenRouter + rule-based fallback
  models.py / schemas.py / config.py / database.py / auth.py
  smoke_test.py                 # local verification
frontend/
  src/pages/{Login,Dashboard,MonitorDetail,PublicStatus}.tsx
  src/components/UptimeBar.tsx
```

MIT — free, forever.
