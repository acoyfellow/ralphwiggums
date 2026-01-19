# Code Conventions

## Secrets

Use Worker bindings (`env.*`), never `process.env` in Workers.

## Effect

Use Effect for async code (concurrency, errors, resources).
