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
# Install validator
pip install pyyaml

# Validate before push
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "✅ Valid" || echo "❌ Invalid - FIX BEFORE PUSHING"
```

**NEVER push YAML syntax errors** - they break CI/CD and waste time!

---

## NORTH STAR / STOP CONDITION

Stop only when **ALL** are true:

1) **A production-ready npm module exists**
   - `package.json` is correct (name, versioning, exports)
   - `README.md` has working examples
   - `bun run build` produces publishable artifacts
   - `npm pack` succeeds and produces the expected tarball contents

2) **Fully E2E testable**
   - `bun test` (or the repo’s test command) runs locally and passes
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
- Use: `python3 -c "import yaml; yaml.safe_load(open('file.yml'))"`
- **NEVER push invalid YAML** - it breaks CI/CD immediately

2) **Do only PRD work**
- If it isn't in `scripts/ralph/prd.json`, don't do it.

3) **One story per iteration**
- Implement exactly one story per iteration (the highest priority failing story).

4) **Verify before commit**
- Run typecheck/tests/lint before committing.
- For Workers/config changes: run local dev and hit endpoints with `curl`.
- **For workflow changes: validate YAML syntax**

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
- `@CHANGELOG.md` (decisions + deploy notes + gotchas)

7) **Secrets**
- Never commit secrets.
- Never rely on `process.env` in Workers.
- Use Worker bindings (`env.*`) in production code paths.

7) **Effect-First Principles**
- Effect-TS solves whole classes of issues out of the box. Use it.
- **ALWAYS use Effect for:** concurrency (`Effect.all`), error handling (`Data.TaggedError`), resource management (`Effect.acquireUseRelease`), retries (`Effect.retry`), streaming (`Effect.Stream`), state (`Effect.Ref`), scheduling (`Effect.sleep`).
- **NEVER use:** `Promise.all`, `try/catch`, `setTimeout`, manual resource cleanup.
- Effect source reference: `~/.vendor/effect` (NOT in this repo - lives higher up in file system).
- If you're writing async code, use Effect. If you're not using Effect, you're probably doing it wrong.

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

**NEVER use:**
- Raw `Promise.all` - use `Effect.all` instead
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
   
   // ❌ DON'T: Promise.all
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

- Effect source: `~/.vendor/effect`
- Use this to understand Effect types, patterns, and APIs
- **NOT IN THIS REPO** - lives higher up in the file system

### Why Effect Matters

Effect-TS provides:
- **Type-safe concurrency** - No race conditions, guaranteed resource cleanup
- **Composable errors** - Errors are values, not exceptions
- **Deterministic execution** - Effects are descriptions, not side effects
- **Resource safety** - Automatic cleanup, no leaks
- **Testability** - Effects can be tested without mocks

**If you're writing async code, use Effect. If you're not using Effect, you're probably doing it wrong.**
