# AGENTS.md

**Effect-first browser automation for Cloudflare Workers.**

## Workflow

Ralph-style loop: pick ONE story → implement → verify → commit → repeat.

## Package Manager

Uses `bun` (not npm).

## Build & Test

```bash
bun run build          # Build package
bun run check          # Typecheck
bun test               # Run tests
```

## Documentation

- [Development Setup](docs/dev-setup.md) - Local dev, two-terminal setup
- [Project Structure](docs/project-structure.md) - Directory layout
- [Git Workflow](docs/git-workflow.md) - Commit format, memory locations
- [Testing](docs/testing.md) - E2E tests, test commands
- [Deployment](docs/deployment.md) - YAML validation, deployment quirks
- [Code Conventions](docs/code-conventions.md) - Secrets, Effect usage
