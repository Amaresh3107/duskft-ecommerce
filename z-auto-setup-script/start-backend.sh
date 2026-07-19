#!/usr/bin/env bash
set -e

echo "Starting MongoDB..."

docker start mongodb >/dev/null 2>&1 || true

echo "Starting Backend..."

cd ../backend

venv/bin/python -m uvicorn server:app --reload --port 8000