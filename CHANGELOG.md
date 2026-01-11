# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2026-01-10

### Story 001: Fix production environment issues
- Fixed `process.env` usage in Workers runtime (now uses `c.env` instead)
- Configured Container binding properly for production deployment
- Workers now deploy successfully to production
- Smoke tests pass on production endpoints

### Story 002: Verify and fix container server reliability
- Container server starts reliably on port 8081
- `/do` endpoint handles all prompt types (action + extraction)
- Browser cleanup happens after every task (no memory leaks)
- Error responses are consistent and actionable
- Iterative extraction retry works (3 attempts with enhanced prompts)

### Story 003: Add E2E tests that prove API works
- Added comprehensive E2E test suite (`src/__tests__/e2e.test.ts`)
- Tests cover: basic action (navigate, click), form filling, extraction, retry logic, timeout handling
- Tests run in local dev environment
- Tests pass consistently (no flakiness)
- Tests skip gracefully in CI without CONTAINER_URL

### Story 004: Package for npm publishing
- `package.json` has correct name, version, exports
- `package.json` includes all required fields (description, keywords, license, repository)
- `dist/` directory contains compiled JS files
- `dist/` has TypeScript declaration files (.d.ts)
- `npm pack` creates tarball with correct structure
- `.npmignore` excludes dev files (tests, scripts, marketing, container, demo)

### Story 005: Polish README and documentation
- README.md quick start example works out-of-the-box
- Clear installation instructions (`npm install ralphwiggums`)
- Complete API documentation for `run()`
- Error types documented
- Troubleshooting section covers common issues
- Two-terminal local dev setup documented

### Story 006: Deploy to production and verify
- All workers deploy successfully (no errors)
- Health check endpoint returns healthy status
- `/do` endpoint accepts requests and returns results
- Production tests pass (curl requests succeed)
- No memory leaks or resource exhaustion

### Story 007: Publish to npm
- Package published to npm
- `npm install ralphwiggums` works
- Fresh install examples work
- Version is 0.0.1
- README shows up on npmjs.com

### Story 008: Fix marketing site UI issues
- Submit button disables during form submission
- Loading spinner only shows during processing (not on page load)
- Clean UI for demo/testing

### Story 009: Install ironalarm and create orchestrator DO foundation
- Installed ironalarm v0.2.0+ (Effect-based)
- Created `OrchestratorDO` class with ReliableScheduler integration
- ReliableScheduler initialized in constructor with state.storage
- Browser automation handler registered with Effect-based operations
- All ironalarm APIs use Effect.runPromise() for execution
- OrchestratorDO extends DurableObject correctly
- TypeScript compiles without errors

### Story 009.1: Integrate demo UI with orchestrator for end-to-end testing
- Demo API (`/api/product-research`) queues tasks via orchestrator instead of calling `/do` directly
- Demo polls orchestrator for task completion status
- Demo extracts completion data from orchestrator session state
- Users can see orchestrator working through demo UI (queue → process → complete)
- Demo shows task iteration progress and final results
- No direct worker calls - everything goes through orchestrator
