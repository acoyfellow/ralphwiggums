# AGENTS.md (RalphWiggums)

This repo is run in a Ralph-style loop:
**pick ONE story → implement → verify → commit → record learnings → repeat**.

This file is the source-of-truth for:
- local dev workflow
- production deploy rules (Cloudflare Workers + Containers)
- known footguns (Docker, Miniflare, Workers env)

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

1) **Do only PRD work**
- If it isn’t in `scripts/ralph/prd.json`, don’t do it.

2) **One story per iteration**
- Implement exactly one story per iteration (the highest priority failing story).

3) **Verify before commit**
- Run whatever checks exist (typecheck/tests/lint) before committing.
- For Workers/config changes: run local dev and hit endpoints with `curl`.

4) **Commit only green**
Commit message:
- `feat: [ID] - [Title]`
- `fix: [ID] - [Title]`
- `chore: [ID] - [Title]`

5) **Memory is files**
Persistent memory is ONLY:
- git commits
- `scripts/ralph/prd.json` (task truth)
- `scripts/ralph/progress.txt` (patterns + learnings)
- `@CHANGELOG.md` (decisions + deploy notes + gotchas)

6) **Secrets**
- Never commit secrets.
- Never rely on `process.env` in Workers.
- Use Worker bindings (`env.*`) in production code paths.

---

## LOCAL DEV: REQUIRED TWO-TERMINAL SETUP

### Terminal 1 — container server (browser automation)
```bash
cd /Users/jordan/Desktop/ralphwiggums
source .env
PORT=8081 bun run --hot container/server.ts
