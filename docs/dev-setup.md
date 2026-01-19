# Development Setup

## Local Dev (Two Terminals Required)

**Terminal 1:** Container server
```bash
source .env && PORT=8081 bun run --hot container/server.ts
```

**Terminal 2:** Dev server
```bash
export CONTAINER_URL=http://localhost:8081 && bun run dev
```

**Why two terminals:** Miniflare can't run containers locally. Container server handles browser automation.

## E2E Tests

```bash
bun run e2e:dev:demo  # E2E test (requires both servers running)
```
