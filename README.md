<div align="center">

<img src="./docs/diagrams/readme-hero.svg" width="100%" alt="PulseWatch — Self-hosted uptime monitoring running on an Azure Virtual Machine"/>

# 🔭 PulseWatch

### Self-hosted uptime monitoring with Telegram alerts, AI-explained incidents, and public status pages.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
![Python](https://img.shields.io/badge/Python-3.11+-3776ab?style=flat-square&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![Deployment](https://img.shields.io/badge/Production-Azure%20VM-0078D4?style=flat-square&logo=microsoftazure&logoColor=white)

[GitHub](https://github.com/Robibiruk/PulseWatch) · [Telegram](https://t.me/iamrobiii) · [LinkedIn](https://www.linkedin.com/in/robel-biruk-5923101b5/) · [Live Demo](https://pulsewatch-monitor.vercel.app)

</div>

---

## ✨ What is PulseWatch?

<img src="./docs/screenshots/dashboard.png" width="100%" alt="PulseWatch Dashboard"/>

PulseWatch is a **full-stack, self-hosted uptime monitoring platform** built for developers who want to know when their services break before users notice.

It continuously checks HTTP/HTTPS endpoints and heartbeat monitors, records uptime and response-time data, opens and resolves incidents automatically, sends alerts through multiple channels, provides public status pages, and uses AI to explain incidents in plain English.

### ☁️ Built for an always-on Azure VPS

PulseWatch's production backend runs on an **Azure Virtual Machine (Azure VM)** instead of a sleeping serverless or free web-service platform. The Azure VM provides the persistent runtime required by the monitoring scheduler and Telegram long-polling bot.

The Azure VM runs the core backend processes continuously:

- ⚡ **FastAPI API** for the application and REST endpoints
- 🔍 **Monitoring worker** for continuous uptime checks
- 🤖 **Telegram bot** using long-polling
- 📡 **Notification dispatcher** for alerts and incident updates
- 🗄️ **Production PostgreSQL database** for PulseWatch data

The frontend is deployed separately and communicates with the Azure-hosted API over HTTPS.

| 🔔 Alerts | 📊 Monitoring | 🌐 Status Pages | 🤖 AI |
|:---:|:---:|:---:|:---:|
| Telegram, Email, Discord, Slack, Webhooks | HTTP/HTTPS + Heartbeat | Shareable, auth-free pages | OpenRouter incident explanations |

---

## 🚀 Quick Start

### Backend

```bash
git clone https://github.com/Robibiruk/PulseWatch.git
cd PulseWatch/backend

python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Set DATABASE_URL and SECRET_KEY in .env

uvicorn main:app --reload --port 8000
```

API: `http://localhost:8000`  
Swagger: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and create an account.

---

## ⚡ Features

| Category | What you get |
|:---|:---|
| **Monitors** | HTTP/HTTPS, heartbeat push checks, 1–30 min intervals, SSL and domain expiry checks |
| **Checks** | Timeout, redirects, IPv4/IPv6, GET/HEAD/POST, basic/bearer auth, status-code rules |
| **Incidents** | Automatic open/resolve, failure threshold, recovery confirmation, duration and severity |
| **Alerts** | Telegram, Email via Resend, Discord, Slack, generic JSON webhooks |
| **Dashboard** | Fleet KPIs, uptime %, response time, filters and monitor details |
| **Status Pages** | Public, auth-free pages with neon, light and minimal themes |
| **Telegram Bot** | `/status`, `/monitors`, `/incidents`, `/pause`, `/resume`, `/help` |
| **Authentication** | Email/password, JWT, bcrypt and API tokens |
| **AI** | OpenRouter-powered plain-English incident explanations |
| **Self-hosting** | Persistent Azure VM deployment with an always-on monitoring worker |

---

## 🏗 Architecture

<img src="./docs/diagrams/architecture.svg" width="100%" alt="PulseWatch production architecture — Vercel frontend, Azure VM backend and PostgreSQL"/>

### Production architecture

```mermaid
graph LR
    FE[Vercel<br/>React SPA] -->|HTTPS| API[Azure VM<br/>FastAPI API]
    API --> DB[(PostgreSQL<br/>Production DB)]
    Worker[Azure VM<br/>Monitoring Worker] --> DB
    Bot[Azure VM<br/>Telegram Bot] --> DB
    Worker --> Notify[Notification Dispatcher]
    Notify --> Channels[Telegram / Email / Discord / Slack / Webhook]
```

PulseWatch is intentionally split into a public frontend and an always-on backend:

**Frontend** → Vercel serves the React/Vite application.  
**Backend** → Azure VM runs FastAPI, the scheduler/worker, and Telegram bot.  
**Database** → PostgreSQL stores users, monitors, incidents, checks, status-page configuration, and alert settings.  
**Notifications** → The worker dispatches incident and recovery alerts to configured channels.

The worker uses `SELECT FOR UPDATE SKIP LOCKED` to atomically claim due monitors. This prevents duplicate checks and duplicate alerts when multiple workers are active.

---

## 🚢 Production Deployment

### Azure Virtual Machine

The production deployment uses an **Azure Virtual Machine running Ubuntu 24.04 LTS** as the self-hosted VPS.

This is the heart of PulseWatch's production infrastructure. Unlike a sleeping web-service deployment, the VM remains available to perform monitoring checks continuously.

| Component | Production location | Role |
|:---|:---|:---|
| **FastAPI** | **Azure VM** | REST API and application backend |
| **Monitoring Worker** | **Azure VM** | Continuously schedules and performs checks |
| **Telegram Bot** | **Azure VM** | Long-polling bot and account linking |
| **PostgreSQL** | **Production database** | Persistent application data |
| **Frontend** | **Vercel** | React/Vite SPA |
| **AI** | OpenRouter | Incident explanations |
| **Email** | Resend | Email notifications |

### Azure VM responsibilities

The VM is responsible for the always-on workload:

1. Accept API requests from the frontend.
2. Run the monitoring scheduler continuously.
3. Probe configured websites and services.
4. Create and resolve incidents.
5. Dispatch notifications.
6. Keep the Telegram bot connected through long-polling.
7. Restart backend services automatically after crashes or VM reboots when configured with a process supervisor.

### Production configuration

```env
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=<long-random-secret>
CORS_ORIGINS=https://your-frontend-domain
PUBLIC_BASE_URL=https://your-api-domain
TELEGRAM_BOT_TOKEN=<bot-token>
OPENROUTER_API_KEY=<openrouter-key>
RESEND_API_KEY=<resend-key>
```

### Azure networking

The Azure VM should have an appropriate **Network Security Group (NSG)** configuration. Expose only the ports required by the deployment, use HTTPS for public API traffic, and restrict SSH access where practical.

For production, run the FastAPI application, monitoring worker, and Telegram bot under a process manager or service supervisor so they automatically restart after failures and system reboots.

> **Why Azure VM?** PulseWatch is an uptime monitor. Putting the monitoring worker on a server that sleeps defeats the purpose. The Azure VM gives the scheduler a persistent, always-on runtime and gives the project a real self-hosted VPS deployment.

---

## 🛠 Tech Stack

| Layer | Technology |
|:---|:---|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 async, Pydantic v2 |
| **Frontend** | React 18, Vite, TypeScript, React Router v6 |
| **Database** | PostgreSQL in production, SQLite for development |
| **Auth** | JWT, python-jose, bcrypt, API tokens |
| **Notifications** | Telegram Bot API, Resend, Discord/Slack webhooks |
| **AI** | OpenRouter (`openai/gpt-oss-20b:free`) |
| **Infrastructure** | Azure Virtual Machine, Vercel |

---

## 📁 Project Layout

```text
PulseWatch/
├── backend/
│   ├── main.py              # FastAPI app + lifespan
│   ├── worker.py            # Monitor scheduler + claim locking
│   ├── checker.py           # HTTP, SSL and domain checks
│   ├── telegram_bot.py      # Telegram bot + account linking
│   ├── notifications.py     # Multi-channel alert dispatch
│   ├── emailer.py           # HTML email templates
│   ├── ai_explain.py        # AI incident explanations
│   ├── models.py            # SQLAlchemy ORM models
│   ├── schemas.py           # Pydantic schemas
│   ├── database.py          # Database engine and migrations
│   ├── config.py            # Application configuration
│   └── routers/             # API route modules
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── auth.tsx
│   │   ├── components/
│   │   └── pages/
│   └── vite.config.ts
├── docs-site/               # Docusaurus documentation
└── README.md
```

---

## 🔧 Environment Variables

### Core

| Variable | Default | Description |
|:---|:---|:---|
| `DATABASE_URL` | required | PostgreSQL async URL in production or SQLite URL for development |
| `SECRET_KEY` | `dev-insecure-change-me` | JWT signing secret |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Public API URL for generated links |

### Worker

| Variable | Default | Description |
|:---|:---|:---|
| `POLL_INTERVAL` | `15` | Scheduler tick in seconds |
| `WORKER_CONCURRENCY` | `20` | Maximum concurrent checks |
| `NO_WORKER` | `false` | Disable built-in worker |
| `FAILURE_THRESHOLD` | `3` | Failures before opening an incident |
| `CONFIRMATION_DELAY` | `10` | Recovery confirmation delay |

### Integrations

| Variable | Description |
|:---|:---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `NO_TELEGRAM_BOT` | Disable Telegram bot when `true` |
| `RESEND_API_KEY` | Resend email API key |
| `ALERT_FROM_EMAIL` | Verified sender address |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OPENROUTER_MODEL` | AI model used for explanations |
| `VITE_API_BASE` | Frontend API base URL |

> See [`backend/.env.example`](backend/.env.example) for the complete configuration.

---

## 📡 API Reference

Authenticated routes require `Authorization: Bearer <jwt>`.

| Method | Path | Description |
|:---|:---|:---|
| `POST` | `/auth/register` | Register |
| `POST` | `/auth/token` | Login |
| `GET` | `/auth/me` | Current user |
| `GET` | `/monitors` | List monitors |
| `POST` | `/monitors` | Create monitor |
| `PATCH` | `/monitors/:id` | Update monitor |
| `DELETE` | `/monitors/:id` | Delete monitor |
| `GET` | `/monitors/summary` | Fleet KPIs |
| `GET` | `/monitors/incidents` | Recent incidents |
| `GET` | `/status/:userId` | Public status page |
| `POST` | `/api/heartbeat/:token` | Heartbeat ping |
| `GET` | `/status/health` | Health check |
| `POST` | `/api/platform/tokens` | Create API token |
| `POST` | `/api/platform/account/password` | Change password |

Interactive Swagger documentation is available at `/docs`.

---

## 🤖 Telegram Bot

The bot uses **long-polling**, so no webhook setup is required.

| Command | Description |
|:---|:---|
| `/start <token>` | Link Telegram to your account |
| `/status` | Show monitor states |
| `/monitors` | List monitors |
| `/incidents` | Show recent incidents |
| `/pause` | Pause alerts |
| `/resume` | Resume alerts |
| `/help` | Show commands |

**Linking:** Dashboard → Settings → Connect Telegram → Telegram → Start.

The bot runs continuously on the Azure VM in production.

---

## 📬 Notifications

When a monitor goes down or recovers, PulseWatch can dispatch alerts to every enabled channel:

- **Telegram** — instant alerts through the linked bot
- **Email** — branded HTML email via Resend
- **Discord** — formatted webhook notification
- **Slack** — incoming webhook notification
- **Generic webhook** — JSON payload for custom integrations

Channel enablement is configured per user, and alerts can be paused globally.

---

## 🧪 Monitor Types

### HTTP / HTTPS

Configurable interval, timeout, redirects, IPv4/IPv6, GET/HEAD/POST methods, basic/bearer authentication, accepted status-code buckets, SSL checks, and domain expiry reminders.

### Heartbeat (Push)

Your service sends a heartbeat to a unique token URL (`POST /api/heartbeat/:token`). If a heartbeat does not arrive within the expected interval, PulseWatch opens an incident. This is useful for cron jobs, workers, and background processes without a public HTTP endpoint.

---

## 🔐 Production Security Checklist

- [ ] Use a long random `SECRET_KEY`.
- [ ] Set `CORS_ORIGINS` to the real frontend domain. Never use `*` in production.
- [ ] Use PostgreSQL in production.
- [ ] Keep API keys and bot tokens out of Git.
- [ ] Configure Azure NSG rules to expose only required ports.
- [ ] Put the public API behind HTTPS and a reverse proxy.
- [ ] Add rate limiting to authentication and heartbeat endpoints.
- [ ] Restrict SSH access to the Azure VM where practical.
- [ ] Run API, worker, and bot under a process supervisor.
- [ ] Keep the Ubuntu Azure VM and installed packages patched.
- [ ] Do not expose database credentials or internal exception details through public API responses.

---

## 🗺 Roadmap

### Reliability
- Alembic migrations
- Durable Redis/RQ or ARQ job queue
- Second-region confirmation
- Rate limiting

### Features
- Incident acknowledgement and assignment
- Maintenance windows
- Escalation policies
- Monitor tags and groups
- 30–90 day SLA charts
- Docker Compose one-command self-hosting
- Team accounts and RBAC

### Scaling
- **MVP:** ≤100 monitors, 1 worker, 1-minute checks
- **Beta:** ~1k monitors, Redis queue, multiple workers
- **Production:** 10k+ monitors, distributed workers across regions

---

<div align="center">

## 👤 Built by

**[Robel Biruk](https://www.linkedin.com/in/robel-biruk-5923101b5/)** — [@Robibiruk](https://github.com/Robibiruk)

## 📄 License

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

MIT License — see [`LICENSE`](LICENSE) for details.

**[⬆ Back to top](#-pulsewatch)**

</div>
