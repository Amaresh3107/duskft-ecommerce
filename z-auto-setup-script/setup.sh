#!/usr/bin/env bash
set -e

echo "========== First Time Setup =========="
echo "1. Setup Frontend"
echo "2. Setup MongoDB"
echo "3. Setup Backend"
echo "======================================"

read -p "Choice: " c

case $c in
    1)
        bash 01_frontend.sh
        ;;
    2)
        bash 02_mongodb.sh
        ;;
    3)
        bash 03_backend.sh
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac