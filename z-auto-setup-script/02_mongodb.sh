#!/usr/bin/env bash

if docker ps --format '{{.Names}}' | grep -q '^mongodb$'; then
    echo "MongoDB is already running."
elif docker ps -a --format '{{.Names}}' | grep -q '^mongodb$'; then
    echo "Starting MongoDB..."
    docker start mongodb
else
    echo "Creating MongoDB container..."
    docker run -d \
        --name mongodb \
        -p 27017:27017 \
        -v mongodb_data:/data/db \
        mongo:latest
fi