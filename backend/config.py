from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    no_telegram_bot: bool = False
    public_base_url: str = "http://localhost:8000"

    # Resend email
    resend_api_key: str = ""
    alert_from_email: str = "alerts@yourdomain.com"
    alert_to_email: str = ""

    # OpenRouter (AI explanations)
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-oss-20b:free"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
