import sys

from pydantic_settings import BaseSettings, SettingsConfigDict

# Windows consoles default to cp1252, which crashes on the emoji used in alert
# copy (e.g. 🚨). Force UTF-8 so the worker/notifications print fallbacks safely
# on any platform. Guarded for exotic runtimes without reconfigure().
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://user:pass@host/dbname"

    # Auth
    secret_key: str = "dev-insecure-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Worker / scheduler
    poll_interval: int = 15
    worker_concurrency: int = 20
    no_worker: bool = False
    failure_threshold: int = 3
    confirmation_delay: int = 10
    ssl_warn_days: int = 14
    checkin_interval_minutes: int = 1440  # periodic "how are your services" digest

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    no_telegram_bot: bool = False
    public_base_url: str = "http://localhost:8000"

    # Resend email
    resend_api_key: str = ""
    alert_from_email: str = "alerts@yourdomain.com"
    alert_to_email: str = ""

    # Other alert channels (global fallback; per-user values take precedence)
    discord_webhook_url: str = ""
    slack_webhook_url: str = ""
    generic_webhook_url: str = ""

    # OpenRouter (AI explanations)
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-oss-20b:free"

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    frontend_url: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
