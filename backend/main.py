from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routers import auth, monitors, status, telegram, heartbeat, statuspage, notifications, platform
from telegram_bot import run_telegram_bot
from worker import run_forever


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
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

app.include_router(auth.router)
app.include_router(monitors.router)
app.include_router(status.router)
app.include_router(telegram.router)
app.include_router(heartbeat.router)
app.include_router(statuspage.router)
app.include_router(notifications.router)
app.include_router(platform.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pulsewatch"}


@app.get("/")
async def root():
    return {"message": "PulseWatch API", "docs": "/docs"}
