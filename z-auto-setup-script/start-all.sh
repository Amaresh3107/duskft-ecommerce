#!/usr/bin/env bash
set -e

echo "======================================"
echo "      Starting Application"
echo "======================================"

########################################
# MongoDB
########################################

if docker ps --format '{{.Names}}' | grep -q '^mongodb$'; then

    echo "✓ MongoDB already running."

elif docker ps -a --format '{{.Names}}' | grep -q '^mongodb$'; then

    echo "Starting MongoDB..."

    docker start mongodb

else

    echo ""
    echo "❌ MongoDB container not found."
    echo ""
    echo "Run:"
    echo "./z-auto-setup-script/setup.sh"
    exit 1

fi

########################################
# Backend Check
########################################

if [ ! -d "../backend/venv" ]; then

    echo ""
    echo "❌ Backend is not setup."
    echo ""
    echo "Run:"
    echo "./z-auto-setup-script/setup.sh"
    exit 1

fi

########################################
# Backend
########################################

echo "Starting Backend..."

osascript <<EOF
tell application "Terminal"
    do script "cd $(pwd)/../backend && venv/bin/python -m uvicorn server:app --reload --port 8000"
end tell
EOF

sleep 2

########################################
# Frontend
########################################

echo "Starting Frontend..."

osascript <<EOF
tell application "Terminal"
    do script "cd $(pwd)/../frontend && npm start"
end tell
EOF

echo ""
echo "======================================"
echo "🚀 Application Started Successfully!"
echo "======================================"