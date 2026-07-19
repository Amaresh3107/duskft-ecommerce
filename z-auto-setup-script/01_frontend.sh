#!/usr/bin/env bash
set -e

cd ../frontend

echo "Setting up frontend..."

nvm install 20 || true
nvm use 20

npm install --legacy-peer-deps
npm install ajv@8.17.1 ajv-keywords@5.1.0 --save-dev --legacy-peer-deps

echo "Starting frontend..."

npm start