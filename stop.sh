#!/bin/bash
# Stop all RalphWiggums development servers

echo "🛑 Stopping RalphWiggums..."

# Our ports
PORTS="8081 8080 1337 1338"

for port in $PORTS; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "  Killing port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null || true
  else
    echo "  Port $port: clean"
  fi
done

# Kill any lingering processes
pkill -f "container/server" 2>/dev/null || true
pkill -f "alchemy dev" 2>/dev/null || true
pkill -f "miniflare" 2>/dev/null || true

echo "✅ All stopped"
