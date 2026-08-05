#!/usr/bin/env bash
set -e

echo "======================================"
echo "   Docker Environment Setup (Ubuntu)"
echo "======================================"

########################################
# Docker Engine
########################################

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not found. Installing Docker Engine..."

    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    sudo usermod -aG docker "$USER"

    echo "✓ Docker installed. You may need to log out and back in for group permissions to apply."
else
    echo "✓ Docker already installed."
fi

########################################
# Docker Compose plugin (in case Docker exists but plugin doesn't)
########################################

if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose plugin not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
else
    echo "✓ Docker Compose already available."
fi

########################################
# Swap space (prevents OOM kills on small instances)
########################################

if ! swapon --show | grep -q '/swapfile'; then
    TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    if [ "$TOTAL_MEM_KB" -lt 2000000 ]; then
        echo "Low memory detected. Setting up 2G swap..."
        sudo fallocate -l 2G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        echo "✓ Swap configured."
    else
        echo "✓ Sufficient RAM detected, skipping swap."
    fi
else
    echo "✓ Swap already configured."
fi

echo ""
echo "======================================"
echo "🎉 Docker environment ready!"
echo "Run: newgrp docker - only needed if docker was just installed"
echo "Run: docker compose up --build -d"
echo "======================================"
