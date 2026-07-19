#!/usr/bin/env bash
set -e

echo "Starting MongoDB..."

docker start mongodb >/dev/null 2>&1 || true

echo "Starting Backend..."

osascript <<EOF
tell application "Terminal"
    do script "cd $(pwd)/../backend && venv/bin/python -m uvicorn server:app --reload --port 8000"
end tell
EOF

sleep 2

echo "Starting Frontend..."

osascript <<EOF
tell application "Terminal"
    do script "cd $(pwd)/../frontend && npm start"
end tell
EOF