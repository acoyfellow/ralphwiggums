#!/bin/bash
# restart-docker.sh - Restart Docker Desktop programmatically
# Usage: ./restart-docker.sh

set -e

echo "🛑 Quitting Docker Desktop..."
osascript -e 'tell application "Docker" to quit' 2>/dev/null || true

# Force quit any remaining Docker processes
pkill -f "Docker Desktop" 2>/dev/null || true
pkill -f "com.docker.virtualization" 2>/dev/null || true
pkill -f "com.docker.backend" 2>/dev/null || true

echo "⏳ Waiting for Docker to fully quit..."
for i in 1 2 3 4 5; do
  sleep 1
  if ! pgrep -f "Docker" > /dev/null 2>&1; then
    echo "✅ Docker processes stopped"
    break
  fi
done

echo "🚀 Starting Docker Desktop..."
open -a Docker

echo "⏳ Waiting for Docker to be ready..."
MAX_ATTEMPTS=60
for i in $(seq 1 $MAX_ATTEMPTS); do
  if docker info > /dev/null 2>&1; then
    echo "✅ Docker is ready!"
    exit 0
  fi
  printf "."
  sleep 1
done

echo ""
echo "❌ Docker failed to start within $MAX_ATTEMPTS seconds"
echo "💡 Try opening Docker Desktop manually from Applications folder"
exit 1
