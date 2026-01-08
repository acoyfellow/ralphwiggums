# ralphwiggums

**Effect-first browser automation on Cloudflare Workers.** Give it a prompt, get a completed task.

Built with [Effect-TS](https://effect.website) for typed error handling and functional composition. Uses [Stagehand](https://docs.stagehand.dev/v3) for AI-powered browser automation.

```bash
npm install ralphwiggums
```

```typescript
import { run, type RalphResult } from "ralphwiggums";

// Simple automation
const result = await run(
  "Go to example.com and get the page title"
);

console.log(result);
// {
//   success: true,
//   message: "Task completed",
//   data: "Example Domain",
//   iterations: 1,
//   checkpointId: "..."
// }
```

## What it does

1. **Prompt → Action** - Send natural language instructions ("click submit button")
2. **Retry Loop** - Automatically retries until task completes or max iterations reached
3. **Error Handling** - Typed errors for every failure mode (timeout, max iterations, browser crash)
4. **Browser Cleanup** - Automatically closes browsers after each task (prevents memory leaks)

## Architecture

ralphwiggums uses a **two-terminal setup** for local development:

- **Container Server** (port 8081): Runs Stagehand for browser automation
- **Worker**: API endpoints that call the container

**Why two terminals?** Cloudflare Workers can't run browsers directly. The browser runs in a separate container, and the worker communicates with it via HTTP.

In production, the container runs in Cloudflare Containers, and the worker uses Container bindings to communicate.

## Response

```typescript
interface RalphResult {
  success: boolean;
  message: string;
  data?: T;              // Extracted data
  iterations: number;
  checkpointId?: string; // For resuming if interrupted
}
```

## Error Types

```typescript
type RalphError =
  | MaxIterationsError   // Task exceeded maxIterations
  | TimeoutError         // Task timed out
  | BrowserError         // Browser operation failed
  | ValidationError      // Invalid prompt/input
  | RateLimitError       // Too many requests
  | UnauthorizedError    // Missing/invalid API key
```

### Error Handling Examples

```typescript
import { run, MaxIterationsError, TimeoutError, BrowserError } from "ralphwiggums";

try {
  const result = await run("Go to example.com and click submit", {
    maxIterations: 3,
    timeout: 30000
  });
  console.log(result.data);
} catch (error) {
  if (error instanceof MaxIterationsError) {
    console.error(`Task failed after ${error.maxIterations} iterations`);
  } else if (error instanceof TimeoutError) {
    console.error(`Task timed out after ${error.duration}ms`);
  } else if (error instanceof BrowserError) {
    console.error(`Browser error: ${error.reason}`);
  } else {
    console.error("Unknown error:", error);
  }
}
```

## Installation

```bash
npm install ralphwiggums
```

**Note**: All examples work in TypeScript. Types are included in the package.

## Prerequisites

- **Node.js 18+** required
- **AI API Key** required for browser automation:
  - `ANTHROPIC_API_KEY` (recommended) or
  - `OPENAI_API_KEY` (alternative)
  - Stagehand uses these keys to control the browser
- See `.env.example` for all environment variables

## Quick Start

1. **Install the package:**
   ```bash
   npm install ralphwiggums
   ```

2. **Set up environment variables:**
   ```bash
   # Copy .env.example to .env and add your AI API key
   ANTHROPIC_API_KEY=your_key_here
   ```

3. **Run your first automation:**
   ```typescript
   import { run } from "ralphwiggums";
   
   const result = await run("Go to example.com and get the page title");
   console.log(result.data); // "Example Domain"
   ```

## Local Development

ralphwiggums requires a **two-terminal setup** for local development because Cloudflare Workers can't run browsers directly.

### Setup

**Terminal 1: Container server** (runs browser automation)
```bash
# From the ralphwiggums directory
source .env
PORT=8081 bun run --hot container/server.ts
```

**Terminal 2: SvelteKit app** (API endpoints + demo UI)
```bash
# From the ralphwiggums directory
bun run dev
```

Visit http://localhost:5173 to use the demo UI, or call the API directly at http://localhost:5173/api/.

### Verify Everything Works

```bash
# Check container is running
curl http://localhost:8081/health
# Expected: {"success":true,"data":{"status":"healthy","browser":false}}

# Check worker is responding
curl http://localhost:5173/health
# Expected: {"status":"healthy",...}
```

### One-Command Startup (Optional)

For convenience, use the provided script to start both terminals:

```bash
# Starts both container and dev server in one command
./dev.sh
```

Stop with `Ctrl+C` (stops both terminals).

### Troubleshooting

| Error | Fix |
|-------|-----|
| "Container binding not set" | Container server isn't running. Start Terminal 1. |
| ECONNREFUSED on port 8081 | Port in use. Kill existing: `lsof -ti:8081 | xargs kill` |
| Browser won't start | Check `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set in `.env` |

## Usage

### `run()` vs `doThis()`

- **`run()`: Promise-based API (recommended for most use cases)**
  ```typescript
  const result = await run("Go to example.com and get title");
  ```

- **`doThis()`: Effect-based API (for advanced use cases with Effect composition)**
  ```typescript
  import { doThis } from "ralphwiggums";
  import { Effect } from "effect";
  
  const program = doThis("Go to example.com");
  const result = await Effect.runPromise(program);
  ```

### Direct API

```typescript
import { run } from "ralphwiggums";

// Simple extraction
const result = await run("Go to https://example.com and get the page title");
console.log(result.data); // "Example Domain"

// Form filling
const result2 = await run(
  "Go to https://example.com/contact, find the name field and type 'John Smith'"
);
```

### Options

```typescript
interface RalphOptions {
  maxIterations?: number;  // Default: 10
  timeout?: number;        // Default: 300000ms (5 minutes)
  resumeFrom?: string;     // Checkpoint ID to resume from
}

const result = await run("Long running task", {
  maxIterations: 5,
  timeout: 60000,  // 1 minute
});
```

### Worker Integration

**Production (Cloudflare Workers with Container binding):**

```typescript
import { createHandlers, setContainerBinding } from "ralphwiggums";

export class RalphAgent extends DurableObject {
  async fetch(request) {
    // Use Container binding in production
    setContainerBinding(this.env.CONTAINER);
    const app = createHandlers();
    return app.fetch(request, this.env);
  }
}
```

**Local Development:**

The worker automatically falls back to `http://localhost:8081` when no Container binding is available. No configuration needed.

## Advanced: Checkpoints

Tasks return a `checkpointId` that you can use to resume interrupted tasks:

```typescript
const result = await run("Long running task", { maxIterations: 10 });

// If task is interrupted, save the checkpointId
const checkpointId = result.checkpointId; // e.g., "task-123-5"

// Later, resume from checkpoint
const resumed = await run("", { resumeFrom: checkpointId });
```

**Note**: Checkpoints expire after 1 hour. They're useful for:
- Long-running tasks that might be interrupted
- Network failures
- Rate limit recovery

## Rate Limiting

By default, ralphwiggums limits requests to **60 per minute per IP address**.

When rate limited, the error response includes a `retryAfter` field (in seconds):

```typescript
try {
  const result = await run("...");
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
    await new Promise(r => setTimeout(r, error.retryAfter * 1000));
    // Retry...
  }
}
```

## Concurrency Limits

By default, ralphwiggums processes **5 concurrent requests** at a time. Additional requests are queued automatically.

Configure via environment variable:
```bash
RALPH_MAX_CONCURRENT=10  # Allow 10 concurrent requests
```

## Deployment

### Prerequisites

- Cloudflare account
- AI API keys (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)
- Alchemy CLI installed (for infrastructure management)

### Steps

1. **Set environment variables:**
   ```bash
   export ANTHROPIC_API_KEY=your_key
   export RALPH_API_KEY=your_api_key  # Optional
   ```

2. **Deploy:**
   ```bash
   bun run deploy
   ```

3. **Verify:**
   ```bash
   curl https://your-worker.workers.dev/health
   ```

The deployment uses Alchemy to manage:
- Container for browser automation
- Worker with Container binding
- KV namespace for rate limiting

See `alchemy.run.ts` for infrastructure configuration.

## Troubleshooting

### "Container binding not set"

**Local dev:**
- Container server isn't running. Start Terminal 1 with `./dev.sh` or manually.

**Production:**
- Verify Container binding is configured in `alchemy.run.ts`
- Check Container is deployed and healthy

### Browser crashes or timeouts

- Verify AI API key is valid: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- Increase `timeout` option for slow pages
- Check network connectivity

### Rate limit errors

- Default: 60 requests/minute per IP
- Wait for `retryAfter` seconds before retrying
- Consider implementing exponential backoff

### Port conflicts

- Container server uses port 8081 by default
- Change with: `PORT=8082 bun run container/server.ts`
- Update `CONTAINER_URL` accordingly

## Package Exports

ralphwiggums provides two exports:

1. **Main export** (most common):
   ```typescript
   import { run, doThis, createHandlers } from "ralphwiggums";
   ```

2. **Checkpoint Durable Object** (production deployments):
   ```typescript
   import { CheckpointDO } from "ralphwiggums/checkpoint-do";
   ```
   
   Use `checkpoint-do` when deploying with Cloudflare Durable Objects for persistent checkpoint storage across multiple worker instances.

## Documentation

### Core Libraries
- **Stagehand** ([docs](https://docs.stagehand.dev/v3), [GitHub](https://github.com/browserbase/stagehand)) - AI-powered browser automation
- **Effect** ([docs](https://effect.website), [GitHub](https://github.com/effect-ts/effect)) - Functional programming library
- **Hono** ([docs](https://hono.dev), [GitHub](https://github.com/honojs/hono)) - Lightweight web framework

### Cloudflare
- **Workers** ([docs](https://developers.cloudflare.com/workers)) - Serverless compute
- **Containers** ([docs](https://developers.cloudflare.com/containers)) - Browser automation in containers

### Reference Implementations
- **AgentCast** ([GitHub](https://github.com/acoyfellow/agentcast)) - Container-based browser automation pattern

## Tests

```bash
# Run tests (E2E tests require container server running)
bun test
```

## Version

0.0.1 - Initial release
