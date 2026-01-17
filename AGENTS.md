# AGENTS.md

Ralph-style loop: pick ONE story → implement → verify → commit → repeat.

## Build & Test

```bash
bun run build          # Build package
bun run check          # Typecheck
bun test               # Run tests
bun run e2e:dev:demo  # E2E test (requires both servers running)
```

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

## Project Layout

```
src/              # Source code
container/        # Container server (browser automation)
e2e-harness/      # E2E tests (gateproof + playwright)
scripts/ralph/    # PRD, progress, learnings
```

## Critical Quirks

**YAML validation:** Validate workflow files before pushing:
```bash
node -e "const yaml = require('yaml'); yaml.parse(require('fs').readFileSync('.github/workflows/deploy.yml', 'utf8'))"
```

**Commit format:** `feat: [ID] - [Title]` or `fix: [ID] - [Title]`

**Memory:** Only git commits, `scripts/ralph/prd.json`, `scripts/ralph/progress.txt`, `CHANGELOG.md`

**Secrets:** Use Worker bindings (`env.*`), never `process.env` in Workers

**Effect:** Use Effect for async code (concurrency, errors, resources)

## E2E Harnesses

Location: `e2e-harness/`. Use gateproof + playwright. See `e2e-harness/dev/demo.test.ts` for template.
