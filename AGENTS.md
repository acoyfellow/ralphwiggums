# AGENTS.md (RalphWiggums)

This repo is run in a Ralph-style loop:
**pick ONE story → implement → verify → commit → record learnings → repeat**.

This file is the source-of-truth for:
- local dev workflow
- production deploy rules (Cloudflare Containers)
- known footguns (Docker, Miniflare)

## ⚠️ CRITICAL: YAML Validation Required

**ALL workflow file changes MUST be validated before pushing:**

```bash
# Option 1: Python (if available)
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "✅ Valid" || echo "❌ Invalid - FIX BEFORE PUSHING"

# Option 2: Node/Bun (alternative)
node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('.github/workflows/deploy.yml', 'utf8')); console.log('✅ Valid')"
```

**NEVER push YAML syntax errors** - they break CI/CD and waste time!

---

## QUICK REFERENCE

```bash
# Local dev (two terminals required)
# Terminal 1: Container server
cd /Users/jordan/Desktop/ralphwiggums && source .env && PORT=8081 bun run --hot container/server.ts

# Terminal 2: Dev server (Vite dev)
cd /Users/jordan/Desktop/ralphwiggums && export CONTAINER_URL=http://localhost:8081 && bun run dev

# Build & test
bun run build && bun run check && bun test

# Validate YAML
node -e "const yaml = require('js-yaml'); const fs = require('fs'); yaml.load(fs.readFileSync('.github/workflows/ci.yml', 'utf8')); console.log('✅ Valid')"
```

## LOCAL DEV SETUP (Happy Path)

**Step 1: Start container server**
```bash
cd /Users/jordan/Desktop/ralphwiggums
source .env
PORT=8081 bun run --hot container/server.ts
```
Expected output:
```
🚀 Container server starting on port 8081
📋 Health check: http://localhost:8081/health
📋 Do endpoint: http://localhost:8081/do
```

**Step 2: Start dev server**
```bash
cd /Users/jordan/Desktop/ralphwiggums
export CONTAINER_URL=http://localhost:8081
bun run dev
```
Expected output:
```
  VITE v7.3.1  ready in <time> ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose

Using vars defined in .dev.vars
```

**Step 3: Verify both servers are running**
```bash
# Container health check
curl http://localhost:8081/health
# Expected: {"status":"ok"}

# Dev server health check
curl http://localhost:5173/api/health
# Expected: {"status":"ok","timestamp":"2026-01-12T11:23:47.344Z"}

# Dev server homepage
curl http://localhost:5173
# Expected: HTML page with "RalphWiggums" visible
```

**Step 4: Test demo UI**
- Visit http://localhost:5173
- Should see RalphWiggums homepage
- Submit product research form with URL and instructions
- Should get results

**Step 5: Stop servers (when done)**
```bash
# In Terminal 1: Ctrl+C to stop container server
# In Terminal 2: Ctrl+C to stop dev server
```

---

## NORTH STAR / STOP CONDITION

Stop only when **ALL** are true:

1) **A production-ready npm module exists**
   - `package.json` is correct (name, versioning, exports)
   - `README.md` has working examples
   - `bun run build` produces publishable artifacts
   - Package is published to npm and installable

2) **Fully E2E testable**
   - `bun test` (or the repo's test command) runs locally and passes
   - E2E tests exercise the real flow end-to-end (not mocks-only)
   - E2E tests are runnable by a new machine with documented prerequisites

3) **Works 100% on local dev**
   - Two-terminal workflow is documented and reliable
   - Smoke tests (curl) succeed on first run
   - No reliance on Cloudflare production-only bindings during local dev

If any of the above is not true, keep iterating.

---

## ABSOLUTE RULES (non-negotiable)

1) **YAML Validation Required**
- **ALL `.github/workflows/*.yml` changes MUST pass validation before pushing**
- Use: `python3 -c "import yaml; yaml.safe_load(open('file.yml'))"` or Node alternative
- **NEVER push invalid YAML** - it breaks CI/CD immediately

2) **Do only PRD work**
- If it isn't in `scripts/ralph/prd.json`, don't do it.

3) **One story per iteration**
- Implement exactly one story per iteration (the highest priority failing story).

4) **Verify before commit**
- Run typecheck/tests/lint before committing.
- For Workers/config changes: run local dev and hit endpoints with `curl`.
- **For workflow changes: validate YAML syntax**
- For production deployments: run `bun run test:demo --url=https://ralphwiggums.coey.dev`

5) **Commit only green**
Commit message:
- `feat: [ID] - [Title]`
- `fix: [ID] - [Title]`
- `chore: [ID] - [Title]`

6) **Memory is files**
Persistent memory is ONLY:
- git commits
- `scripts/ralph/prd.json` (task truth)
- `scripts/ralph/progress.txt` (patterns + learnings)
- `CHANGELOG.md` (decisions + deploy notes + gotchas)

7) **Secrets**
- Never commit secrets.
- Never rely on `process.env` in Workers.
- Use Worker bindings (`env.*`) in production code paths.

8) **Effect-First Principles**
- Effect-TS solves whole classes of issues out of the box. Use it.
- **ALWAYS use Effect for:** concurrency (`Effect.all`), error handling (`Data.TaggedError`), resource management (`Effect.acquireUseRelease`), retries (`Effect.retry`), streaming (`Effect.Stream`), state (`Effect.Ref`), scheduling (`Effect.sleep`).
- **PREFER Effect over:** `Promise.all` (use `Effect.all` for complex orchestration), `try/catch` (use `Effect.catchAll` or typed errors), `setTimeout` (use `Effect.sleep`), manual resource cleanup (use `Effect.acquireUseRelease`).
- If you're writing async code, use Effect. If you're not using Effect, you're probably doing it wrong.

9) **Deploy Verification Required**
- After GitHub Actions deployment completes, verify production is working.
- Run test script: `bun run test:demo --url=https://ralphwiggums.coey.dev`
- Check production health: `curl https://ralphwiggums.coey.dev/health`
- If failures occur, check logs with: `wrangler tail ralphwiggums-ralphwiggums-api-prod`
- Never assume deployment succeeded without verification.
- See DEPLOYMENT VERIFICATION section for detailed commands and request tracing.

---

## LOCAL DEV: REQUIRED TWO-TERMINAL SETUP

### Terminal 1 — container server (browser automation)
```bash
cd /Users/jordan/Desktop/ralphwiggums
source .env
PORT=8081 bun run --hot container/server.ts
```

### Terminal 2 — alchemy dev (API + Demo workers)
```bash
cd /Users/jordan/Desktop/ralphwiggums
export CONTAINER_URL=http://localhost:8081
bun run dev
```

---

## DEPLOYMENT VERIFICATION

### After GitHub Actions Deployment

**Verify staging deployment:**
```bash
bun run test:demo --url=https://ralphwiggums-staging.coey.dev
```

**Verify production deployment:**
```bash
bun run test:demo --url=https://ralphwiggums.coey.dev
```

**Check production health:**
```bash
curl https://ralphwiggums.coey.dev/health
```

**Check production logs:**
```bash
wrangler tail ralphwiggums-ralphwiggums-api-prod
```

**Request tracing:**
- All requests include `requestId` for tracing
- Logs are prefixed: `[WORKER:reqId]`, `[CONTAINER:reqId]`, `[RALPH:reqId]`
- Use `wrangler tail` to follow request flow through worker → container → Ralph loop

### Test Script Usage

**Test local dev:**
```bash
bun run test:demo
# Defaults to http://localhost:5173
```

**Test staging:**
```bash
bun run test:demo --url=https://ralphwiggums-staging.coey.dev
```

**Test production:**
```bash
bun run test:demo --url=https://ralphwiggums.coey.dev
```

**What test-demo does:**
1. Runs health check
2. Sends test request to `/api/product-research`
3. Logs response status, headers, timing
4. Displays full result or error
5. Provides `wrangler tail` instructions for deeper debugging

---

## EFFECT-FIRST PRINCIPLES (detailed)

**Effect-TS solves whole classes of issues out of the box. Use it.**

### When to Use Effect

**ALWAYS use Effect for:**
- **Concurrency** - `Effect.all` for parallel operations (health checks, task dispatch)
- **Error handling** - Typed errors with `Data.TaggedError`, no try/catch
- **Resource management** - `Effect.acquireUseRelease` for browser lifecycle
- **Retries** - `Effect.retry` with exponential backoff
- **Streaming** - `Effect.Stream` for real-time events (WebSocket/SSE)
- **State management** - `Effect.Ref` for shared state (pool status)
- **Scheduling** - `Effect.sleep` for delays, not `setTimeout`

**PREFER Effect over:**
- Raw `Promise.all` - use `Effect.all` for complex orchestration (simple cases are fine)
- `try/catch` blocks - use `Effect.catchAll` or typed errors
- `setTimeout` - use `Effect.sleep`
- Manual resource cleanup - use `Effect.acquireUseRelease`

### Effect Patterns for Orchestrator

1. **Browser Pool Health Checks**
   ```typescript
   // ✅ DO: Effect.all for concurrent checks
   const statuses = yield* Effect.all(
     pool.instances.map(instance => checkHealth(instance)),
     { concurrency: pool.size }
   );
   
   // ❌ DON'T: Promise.all for complex orchestration
   const statuses = await Promise.all(
     pool.instances.map(instance => checkHealth(instance))
   );
   ```

2. **Task Dispatcher**
   ```typescript
   // ✅ DO: Effect.all for parallel task execution
   yield* Effect.all(
     tasks.map(task => executeTask(task)),
     { concurrency: availableBrowsers.length }
   );
   ```

3. **Resource Management**
   ```typescript
   // ✅ DO: acquireUseRelease for browser lifecycle
   yield* Effect.acquireUseRelease(
     acquireBrowser(),
     (browser) => runTask(browser),
     (browser) => releaseBrowser(browser)
   );
   ```

4. **Error Handling**
   ```typescript
   // ✅ DO: Typed errors with Data.TaggedError
   export class BrowserError extends Data.TaggedError("BrowserError")<{
     reason: string;
     requestId: string;
   }> {}
   
   // ❌ DON'T: throw Error
   throw new Error("Browser failed");
   ```

5. **Streaming**
   ```typescript
   // ✅ DO: Effect.Stream for real-time events
   const stream = Stream.async<TaskEvent>((emit) => {
     subscribeToEvents((event) => emit.single(event));
   });
   ```

### Effect Source Reference

- Effect documentation: https://effect.website
- Effect GitHub: https://github.com/effect-ts/effect
- Use these to understand Effect types, patterns, and APIs

### Why Effect Matters

Effect-TS provides:
- **Type-safe concurrency** - No race conditions, guaranteed resource cleanup
- **Composable errors** - Errors are values, not exceptions
- **Deterministic execution** - Effects are descriptions, not side effects
- **Resource safety** - Automatic cleanup, no leaks
- **Testability** - Effects can be tested without mocks

**If you're writing async code, use Effect. If you're not using Effect, you're probably doing it wrong.**
