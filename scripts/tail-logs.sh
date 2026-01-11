#!/bin/bash
# Tail logs for ralphwiggums production deployment
# Usage: ./scripts/tail-logs.sh [worker|container|do|all]

set -e

WORKER_NAME="ralphwiggums-ralphwiggums-api-prod"
CONTAINER_NAME="ralphwiggums-container"
DO_NAME="ralphwiggums-ralphwiggums-api-prod_RalphContainer"

case "${1:-all}" in
  worker)
    echo "📊 Tailing Worker logs: $WORKER_NAME"
    bunx wrangler tail $WORKER_NAME --format pretty
    ;;
  container)
    echo "📦 Tailing Container logs: $CONTAINER_NAME"
    echo "Note: Container logs are accessed via the worker"
    bunx wrangler tail $WORKER_NAME --format pretty --filter "container"
    ;;
  do)
    echo "🔷 Tailing Durable Object logs: $DO_NAME"
    bunx wrangler tail $WORKER_NAME --format pretty --filter "durable_object"
    ;;
  all|*)
    echo "📊 Tailing all logs for $WORKER_NAME"
    echo "Press Ctrl+C to stop"
    echo ""
    bunx wrangler tail $WORKER_NAME --format pretty
    ;;
esac
