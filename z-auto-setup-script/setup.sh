#!/usr/bin/env bash
set -e

echo "======================================"
echo "      Wholesale E-Commerce Setup"
echo "======================================"

########################################
# Homebrew
########################################

if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew not found."
    echo "Installing Homebrew..."

    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    if [[ $(uname -m) == "arm64" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        eval "$(/usr/local/bin/brew shellenv)"
    fi
else
    echo "✓ Homebrew already installed."
fi

########################################
# Python
########################################

if ! command -v python3.11 >/dev/null 2>&1; then
    echo "Python 3.11 not found."
    echo "Installing Python 3.11..."

    brew install python@3.11
else
    echo "✓ Python 3.11 already installed."
fi

########################################
# NVM
########################################

export NVM_DIR="$HOME/.nvm"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "NVM not found."
    echo "Installing NVM..."

    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

echo "✓ NVM Ready."

########################################
# Node.js
########################################

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found."
    echo "Installing Node.js 20..."

    nvm install 20
else
    echo "✓ Node.js already installed."
    nvm install 20 >/dev/null
fi

nvm use 20

########################################
# Docker
########################################

if ! command -v docker >/dev/null 2>&1; then
    echo ""
    echo "❌ Docker Desktop is not installed."
    echo ""
    echo "Install Docker Desktop:"
    echo "https://www.docker.com/products/docker-desktop/"
    exit 1
fi

########################################
# MongoDB
########################################

echo ""
echo "========== MongoDB =========="

if docker ps --format '{{.Names}}' | grep -q '^mongodb$'; then

    echo "✓ MongoDB already running."

elif docker ps -a --format '{{.Names}}' | grep -q '^mongodb$'; then

    echo "Starting MongoDB..."

    docker start mongodb

else

    echo "Creating MongoDB Container..."

    docker run -d \
        --name mongodb \
        -p 27017:27017 \
        -v mongodb_data:/data/db \
        mongo:latest

fi

########################################
# Backend
########################################

echo ""
echo "========== Backend =========="

cd backend/

python3.11 -m venv venv || true

venv/bin/python -m pip install --upgrade pip

sed -i.bak '/emergentintegrations==0.2.0/d' requirements.txt || true

venv/bin/pip install -r requirements.txt

########################################
# Frontend
########################################

echo ""
echo "========== Frontend =========="

cd frontend/

npm install --legacy-peer-deps

npm install \
ajv@8.17.1 \
ajv-keywords@5.1.0 \
--save-dev \
--legacy-peer-deps

echo ""
echo "======================================"
echo "🎉 Setup Completed Successfully!"
echo ""
echo "Run:"
echo "./z-auto-setup-script/start-all.sh"
echo "======================================"