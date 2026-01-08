#!/bin/bash

# RalphWiggums Local Development
# Single script to run everything: container server + Alchemy dev
# Usage: ./dev.sh     (start)
#          ./stop.sh   (stop)

set -e

CONTAINER_PORT=8081
CONTAINER_URL="http://localhost:$CONTAINER_PORT"
API_PORT=1337

case "$1" in
  start)
    echo "🚀 Starting RalphWiggums dev environment..."
    echo ""

    # Clean up any existing processes
    echo "🧹 Cleaning up existing processes..."
    for port in $CONTAINER_PORT $API_PORT; do
      pid=$(lsof -ti:$port 2>/dev/null || true)
      if [ -n "$pid" ]; then
        echo "  Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
      fi
    done

    pkill -f "container/server" 2>/dev/null || true
    pkill -f "bun run" 2>/dev/null || true
    pkill -f "alchemy dev" 2>/dev/null || true

    sleep 2
    echo ""

    # Start container server
    echo "📦 Starting container server (port $CONTAINER_PORT)..."
    cd /Users/jordan/Desktop/ralphwiggums
    source .env 2>/dev/null || true
    mkdir -p logs
    PORT=$CONTAINER_PORT bun run --hot container/server.ts > logs/container-$(date +%s).log 2>&1 &
    CONTAINER_PID=$!

    # Wait for container server to be ready
    echo "⏳ Waiting for container server..."
    for i in {1..30}; do
      if curl -s http://localhost:$CONTAINER_PORT/health >/dev/null 2>&1; then
        echo "  ✅ Container server ready!"
        break
      fi
      sleep 1
    done

    if ! curl -s http://localhost:$CONTAINER_PORT/health >/dev/null 2>&1; then
      echo "  ❌ Container server failed to start"
      cat logs/container-$(date +%s).log
      exit 1
    fi

    # Export CONTAINER_URL and start Alchemy dev
    echo "🔧 Starting Alchemy dev (API + Demo)..."
    export CONTAINER_URL="$CONTAINER_URL"
    cd /Users/jordan/Desktop/ralphwiggums
    mkdir -p logs
    npx alchemy dev --env-file .env alchemy.run.ts > logs/alchemy-$(date +%s).log 2>&1 &
    DEV_PID=$!

    echo ""
    echo "✅ Development environment started!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Container:  http://localhost:$CONTAINER_PORT (PID: $CONTAINER_PID)"
    echo "  API Worker: http://localhost:1337 (PID: $DEV_PID)"
    echo "  Demo Site:  http://localhost:1338 (PID: $DEV_PID)  ← OPEN THIS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Logs:"
    LATEST_CONTAINER=$(ls -t logs/container-*.log 2>/dev/null | head -1)
    LATEST_ALCHEMY=$(ls -t logs/alchemy-*.log 2>/dev/null | head -1)
    if [ -n "$LATEST_CONTAINER" ]; then
      echo "  Container: tail -f $LATEST_CONTAINER"
    fi
    if [ -n "$LATEST_ALCHEMY" ]; then
      echo "  Dev API:    tail -f $LATEST_ALCHEMY"
    fi
    echo ""
    echo "🛑 To stop: ./stop.sh or Ctrl+C"
    echo ""

    trap "echo ''; echo '🛑 Stopping...'; ./stop.sh; exit 0" INT TERM

    wait $CONTAINER_PID $DEV_PID
    ;;

  stop)
    echo "🛑 Stopping RalphWiggums dev environment..."
    echo ""

    if [ -f "logs/container-$(date +%s).log" ]; then
      echo "  📦 Stopping container server..."
      CONTAINER_PID=$(pgrep -f "container/server.ts" | head -1 | awk '{print $1}')
      if [ -n "$CONTAINER_PID" ]; then
        kill -9 $CONTAINER_PID 2>/dev/null || true
      fi
    fi

    if [ -f "logs/alchemy-$(date +%s).log" ]; then
      echo "  🔧 Stopping Alchemy dev..."
      DEV_PID=$(pgrep -f "alchemy dev" | head -1 | awk '{print $1}')
      if [ -n "$DEV_PID" ]; then
        kill -9 $DEV_PID 2>/dev/null || true
      fi
    fi

    pkill -f "bun run" 2>/dev/null || true

    sleep 2

    echo ""
    echo "✅ All processes stopped"
    ;;

  *)
    echo "Usage: $0 {start|stop}"
    echo ""
    echo "  start  - Start container server + Alchemy dev"
    echo "  stop   - Stop all processes"
    exit 1
    ;;
esac
