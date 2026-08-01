#!/usr/bin/env bash
# Render start command. Single-service MVP: the API runs the worker scheduler
# and Telegram bot in-process (unless NO_WORKER / NO_TELEGRAM_BOT are set).
# GitHub Actions cron adds a redundant, claiming worker every minute.
uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
