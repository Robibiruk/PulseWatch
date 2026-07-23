#!/usr/bin/env bash
# Render start command. The API can sleep; the worker lives in GitHub Actions.
uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
