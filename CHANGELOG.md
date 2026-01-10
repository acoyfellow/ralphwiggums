# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2026-01-10

### Added
- **Promise tag completion detection** - automatic task completion when AI returns `<promise>TASK_COMPLETE</promise>`
- **Browser pool infrastructure** - persistent browser management with create/acquire/release operations
- **Orchestrator foundation** - ReliableScheduler integration with ironalarm v0.2.0+
- **Container API enhancements** - configurable `maxIterations` parameter, pool management endpoints
- **Session state management** - checkpoint/resume functionality for task persistence
- **WebSocket streaming support** - real-time task progress updates
- **Comprehensive test suite** - unit tests for promise tags, integration tests, E2E framework

### Fixed
- **Critical**: Removed `process.env` usage from Workers runtime (use `c.env` instead)
- Container fallback logic (CONTAINER binding → env → localhost)
- Browser cleanup after every task (no memory leaks)
- Error handling with typed errors via Effect-TS

### Changed
- Updated to ironalarm v0.2.0+ for Effect-based operations
- Simplified README examples to natural language
- Updated package.json with explicit `files` array (only essential files published)
- `.npmignore` excludes dev files (tests, scripts, marketing, container, demo)
- Container server now supports configurable iteration limits

### Technical Implementation
- **Effect-TS integration** for type-safe, composable async operations
- **Browser pool API** (`/pool/create`, `/pool/acquire`, `/pool/release`, `/pool/status`)
- **Promise tag regex** `/<promise>(.*?)<\/promise>/gi` for completion detection
- **Iteration control ownership** clarified between container and orchestrator
- **Session state persistence** with checkpoint storage

### Documentation
- AGENTS.md - Ralph Loop rules and workflow
- NOTES.md - Critical learnings and gotchas for development
- README.md - User-facing documentation with installation and usage examples

### Package
- Size: 13.9 kB (expanded with orchestrator features)
- Files: LICENSE, README.md, package.json, dist/index.js, dist/index.d.ts, dist/checkpoint-do.js, dist/checkpoint-do.d.ts

### Breaking Changes
- Container `/do` endpoint now accepts `maxIterations` parameter (defaults to 3)
- Promise tag detection may change iteration behavior (early completion)
