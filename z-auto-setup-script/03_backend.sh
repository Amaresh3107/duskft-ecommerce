#!/usr/bin/env bash
set -e

cd ../backend

python3.11 -m venv venv || true

venv/bin/python -m pip install --upgrade pip

sed -i.bak '/emergentintegrations==0.2.0/d' requirements.txt || true

venv/bin/pip install -r requirements.txt

echo "Starting Backend..."

venv/bin/python -m uvicorn server:app --reload --port 8000