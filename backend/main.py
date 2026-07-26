from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routers import auth, monitors, status, telegram
from telegram_bot import run_telegram_bot
from worker import run_forever


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Auto-start the continuous monitoring scheduler unless disabled (e.g. when a
    # separate worker process / GitHub Actions owns the loop).
    if not settings.no_worker:
        async with run_forever():
            # Auto-start the Telegram bot when a token is configured.
            if settings.telegram_bot_token and not settings.no_telegram_bot:
                async with run_telegram_bot():
                    yield
            else:
                yield
    else:
        print("[worker] NO_WORKER=true — scheduler not started (external worker expected)")
        yield


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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pulsewatch"}


@app.get("/")
async def root():
    return {"message": "PulseWatch API", "docs": "/docs"}
