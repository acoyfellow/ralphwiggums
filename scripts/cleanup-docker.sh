#!/bin/bash
# Clean up Docker containers and volumes from Alchemy dev

echo "🧹 Cleaning up Docker containers..."
docker ps -a | grep -E "ralph|desktop-linux" | awk '{print $1}' | xargs -r docker rm -f

echo "🗑️ Pruning Docker system..."
docker system prune -f

echo "✅ Docker cleanup complete"
