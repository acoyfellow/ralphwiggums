# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2026-01-07

### Added
- Production-ready npm module with Effect-first browser automation
- Two-terminal local dev setup (container on port 8081, worker with CONTAINER_URL)
- E2E tests that exercise real browser automation (9 tests)
- Worker bindings support for production (CONTAINER, CONTAINER_URL env vars)

### Fixed
- **Critical**: Removed `process.env` usage from Workers runtime (use `c.env` instead)
- Container fallback logic (CONTAINER binding → env → localhost)
- Browser cleanup after every task (no memory leaks)
- Error handling with typed errors via Effect-TS

### Changed
- Simplified README examples to natural language
- Updated package.json with explicit `files` array (only essential files published)
- `.npmignore` excludes dev files (tests, scripts, marketing, container, demo)

### Documentation
- AGENTS.md - Ralph Loop rules and workflow
- NOTES.md - Critical learnings and gotchas for development
- README.md - User-facing documentation with installation and usage examples

### Package
- Size: 2.9 kB
- Files: LICENSE, README.md, package.json, dist/index.js, dist/index.d.ts, dist/checkpoint-do.js, dist/checkpoint-do.d.ts

---

## Upcoming (Post-Launch Plans)

See `post-launch/README.md` for planned features:
- Orchestrator for task queueing
- Priority-based task execution
- Enhanced checkpoint/resume flow
- Pool management for multiple browser instances
