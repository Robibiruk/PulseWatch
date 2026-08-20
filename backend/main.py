from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response
from database import init_db, is_db_unavailable_error
from routers import auth, monitors, status, telegram, heartbeat, statuspage, notifications, platform
from telegram_bot import run_telegram_bot
from worker import run_forever


@asynccontextmanager
async def lifespan(app: FastAPI):
    # A provider quota/suspension outage must not crash-loop the web service.
    # Boot degraded instead: /health still answers (so the platform keeps the
    # instance alive and the cause is visible), and the worker/bot stay down
    # because every tick would just fail against the same dead database.
    app.state.db_available = True
    app.state.db_error = None
    try:
        await init_db()
    except Exception as exc:  # noqa: BLE001
        if not is_db_unavailable_error(exc):
            raise
        app.state.db_available = False
        app.state.db_error = f"{type(exc).__name__}: {exc}"
        print(
            "[startup] DEGRADED: the database is not accepting connections "
            f"({app.state.db_error}).\n"
            "[startup] This is a provider quota/suspension state, not a code "
            "failure — serving /health only. Restore the database to resume."
        )
        yield
        return

    # Worker scheduler (continuous monitoring engine). Optional when an external
    # worker / GitHub Actions owns the loop.
    worker_ctx = None
    if not settings.no_worker:
        worker_ctx = run_forever()
        await worker_ctx.__aenter__()
    else:
        print("[worker] NO_WORKER=true — scheduler not started (external worker expected)")
    # Telegram bot: starts independently of the worker, whenever a token is set.
    bot_ctx = None
    if settings.telegram_bot_token and not settings.no_telegram_bot:
        bot_ctx = run_telegram_bot()
        await bot_ctx.__aenter__()
    elif not settings.telegram_bot_token:
        print("[telegram] no TELEGRAM_BOT_TOKEN set — bot not started")
    try:
        yield
    finally:
        if bot_ctx is not None:
            await bot_ctx.__aexit__(None, None, None)
        if worker_ctx is not None:
            await worker_ctx.__aexit__(None, None, None)


app = FastAPI(title="PulseWatch API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(auth.router)
app.include_router(monitors.router)
app.include_router(status.router)
app.include_router(telegram.router)
app.include_router(heartbeat.router)
app.include_router(statuspage.router)
app.include_router(notifications.router)
app.include_router(platform.router)


@app.get("/health")
async def health(request: Request, response: Response):
    """Liveness + database reachability.

    Returns 503 with status "degraded" when the database is unavailable, so an
    uptime tool (including PulseWatch itself) reports the truth instead of a
    green tick on a service that cannot serve data.
    """
    if not getattr(request.app.state, "db_available", True):
        response.status_code = 503
        return {
            "status": "degraded",
            "service": "pulsewatch",
            "database": "unavailable",
            "detail": getattr(request.app.state, "db_error", None),
        }
    return {"status": "ok", "service": "pulsewatch", "database": "ok"}


@app.get("/")
async def root():
    return {"message": "PulseWatch API", "docs": "/docs"}
