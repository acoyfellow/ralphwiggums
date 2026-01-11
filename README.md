# ralphwiggums

**Effect-first browser automation for Cloudflare Workers.** Give it a prompt, get a completed task.

```typescript
import { run } from "ralphwiggums";

// That's it. Just tell it what to do.
const result = await run("Go to example.com and get the page title");

console.log(result.data); // "Example Domain"
```

```bash
bun install ralphwiggums
```

Built with [Effect-TS](https://effect.website) for typed error handling and functional composition. Uses [Stagehand](https://docs.stagehand.dev/v3) for AI-powered browser automation.

## Inspiration

This library is inspired by the **Ralph Loop** pattern discovered by [Geoffrey Huntley](https://ghuntley.com/). The Ralph Loop is a simple but powerful pattern: give an AI agent a task, let it iterate until completion, and handle failures gracefully. As Geoffrey puts it, "Ralph Wiggum as a software engineer" — persistent, determined, and surprisingly effective.

Learn more about Ralph Loops and Geoffrey's work on [his blog](https://ghuntley.com/) and [Twitter](https://x.com/GeoffreyHuntley). For best practices on running Ralph-style loops, see [Matt Pocock's 11 Tips for AI Coding with Ralph Wiggum](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum).

## What it does

1. **Prompt → Action** - Send natural language instructions ("click submit button")
2. **Retry Loop** - Automatically retries until task completes or max iterations reached
3. **Error Handling** - Typed errors for every failure mode (timeout, max iterations, browser crash)
4. **Browser Cleanup** - Automatically closes browsers after each task (prevents memory leaks)

## Architecture

ralphwiggums uses a **three-tier Cloudflare Workers architecture** for scalable browser automation:

```
┌─────────────────────────────────────────────────────┐
│ SvelteKit App (Demo UI)                             │
│ src/routes/                                         │
│   ├── +page.svelte          - Main landing page     │
│   ├── +layout.svelte        - Layout with sidebar   │
│   └── api/product-research/  - API endpoint         │
├─────────────────────────────────────────────────────┤
│ Worker (ralphwiggums-api)                           │
│ src/worker.ts                                       │
│   └── OrchestratorDO         - Task scheduling       │
├─────────────────────────────────────────────────────┤
│ Container (ralph-container)                         │
│ container/server.ts                                 │
│   └── Stagehand browser     - Real browser control  │
└─────────────────────────────────────────────────────┘
```

**Component Responsibilities:**
- **Orchestrator DO** (Durable Object): Manages task scheduling, persistence, and session state using ironalarm
- **Container Server** (port 8081): Manages browser pool and executes individual automation tasks
- **Worker/API**: REST endpoints for queueing tasks and monitoring status

**Why this architecture?**
- **Orchestrator**: Handles persistence, retries, and concurrent task management
- **Container**: Owns browser lifecycle and resource management
- **Worker**: Provides HTTP API interface to the orchestrator

This separation enables reliable, resumable browser automation with proper resource management.

## AI Provider

ralphwiggums uses **OpenCode Zen** for browser automation. Zen offers free models to get started.

### OpenCode Zen

**Required environment variable:**
```bash
ZEN_API_KEY=your_zen_api_key_here
```

**Getting your API key:**
1. Sign up for a free OpenCode Zen account
2. Get your API key from the Zen dashboard
3. Use that key as `ZEN_API_KEY` in your environment

**Optional configuration:**
```bash
AI_PROVIDER=zen                    # Default, can be omitted
ZEN_MODEL=claude-sonnet-4-5-20250929 # Default model (free tier available)
```

**Free tier:** OpenCode Zen offers free models to get started with browser automation.

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

**ralphwiggums requires Cloudflare Workers infrastructure.**

```bash
# Install ralphwiggums and required Cloudflare peer dependencies
bun install ralphwiggums @cloudflare/containers @cloudflare/workers-types
```

**Note**: All examples work in TypeScript. Types are included in the package.

## Prerequisites

- **Node.js 18+** required
- **Cloudflare Workers** - This package is built for Cloudflare Workers and requires:
  - `@cloudflare/containers` (peer dependency)
  - `@cloudflare/workers-types` (peer dependency)
  - Cloudflare account with Workers enabled
- **AI Provider** required for browser automation:
  - **OpenCode Zen** - Requires `ZEN_API_KEY`
  - Model: `claude-sonnet-4-5-20250929`
- See `.env.example` for all environment variables

## Quick Start

### Minimal Setup (3 steps)

**1. Install:**
```bash
bun install ralphwiggums @cloudflare/containers @cloudflare/workers-types
```

**2. Set required environment variable:**
```bash
# Create .env file
echo "ZEN_API_KEY=your_zen_api_key_here" > .env
```

Get your Zen API key: [Sign up for OpenCode Zen](https://opencode.zen.com) → Dashboard → API Keys (free tier available)

**3. Run your first automation:**
```typescript
import { run } from "ralphwiggums";

const result = await run("Go to example.com and get the page title");
console.log(result.data); // "Example Domain"
```

That's it! The defaults work for most use cases.

---

### Complete Configuration

**Required:**
```bash
ZEN_API_KEY=your_zen_api_key_here  # OpenCode Zen API key (get from zen.com dashboard)
```

**Optional - API Security:**
```bash
RALPH_API_KEY=your_api_key_here    # Protect your API with key authentication
```

**Optional - Performance Tuning:**
```bash
RALPH_MAX_CONCURRENT=5              # Max concurrent requests (default: 5)
RALPH_REQUEST_TIMEOUT=300000         # Task timeout in ms (default: 300000 = 5 min)
RALPH_MAX_PROMPT_LENGTH=10000        # Max prompt length (default: 10000)
```

**Optional - Debugging:**
```bash
RALPH_DEBUG=false                    # Enable verbose debug logs (default: false)
```

**Optional - Local Development:**
```bash
CONTAINER_URL=http://localhost:8081  # Container server URL (default: http://localhost:8081)
```

**Optional - AI Provider:**
```bash
AI_PROVIDER=zen                      # "zen" or "cloudflare" (default: zen)
ZEN_MODEL=claude-sonnet-4-5-20250929 # Zen model (default: claude-sonnet-4-5-20250929)

# Alternative: Cloudflare AI (requires all three)
# CLOUDFLARE_ACCOUNT_ID=your_account_id
# CLOUDFLARE_API_TOKEN=your_api_token
# CLOUDFLARE_MODEL=your_model_name
```

**Optional - Deployment (Alchemy):**
```bash
ALCHEMY_PASSWORD=your_password       # Alchemy infrastructure password
ALCHEMY_STATE_TOKEN=your_token       # Alchemy state token
STAGE=prod                           # "prod", "dev", or "pr-{number}"
```

---

### Usage Examples

**In a Cloudflare Worker:**
```typescript
import { run } from "ralphwiggums";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const result = await run("Go to example.com and get the page title");
    return Response.json(result);
  }
};
```

**HTTP API:**
```bash
curl -X POST https://your-worker.workers.dev/do \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your_api_key" \
  -d '{"prompt": "Go to example.com and get the page title"}'
```

**Response:**
```json
{
  "success": true,
  "data": "Example Domain",
  "message": "Task completed successfully",
  "iterations": 1
}
```

---

### Verify Setup

**Local Development:**
```bash
# Terminal 1: Container server (browser automation)
source .env
PORT=8081 bun run --hot container/server.ts

# Terminal 2: Dev server (API + demo UI)
export CONTAINER_URL=http://localhost:8081
bun run dev

# Test container
curl http://localhost:8081/health
# Expected: {"status":"ok"}

# Test worker
curl http://localhost:5173/health
# Expected: {"status":"healthy",...}
```

**Production:**
```bash
# Deploy
bun run deploy

# Verify
curl https://your-worker.workers.dev/health
# Expected: {"status":"healthy",...}
```

## Local Development

ralphwiggums requires a **two-terminal setup** for local development.

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
| Browser won't start | Check `ZEN_API_KEY` is set in `.env` |
| Port 8080 conflict | Alchemy dev uses port 8080. Container server uses 8081 by default. |
| Docker containers accumulating | Clean up before deploy: `docker ps -a \| grep -E "ralph\|desktop-linux" \| awk '{print $1}' \| xargs -r docker rm -f && docker system prune -f` |

#### Stagehand Extraction Behavior

Understanding how Stagehand handles extraction is important for getting reliable results:

- **`extract()` returns `{ extraction: "text" }`** - The response object has an `extraction` property, not `text`
- **`act()` handles both actions AND extraction** - Stagehand v3's `act()` is "intelligent" - it can navigate, extract, and interact based on natural language
- **Best approach**: Use `extract()` for extraction prompts
- **Prompt format matters**: 
  - ✅ Works: "Go to URL and get all visible text"
  - ❌ Doesn't work: "Extract from URL: instructions"
  - ✅ Fixed: Auto-transform "Extract from URL: instructions" → "Go to URL and instructions"
- **Zod schema optional**: Pass `undefined` to `extract()` for raw text

#### Docker Cleanup

Before deploying, clean up old Docker containers to prevent memory issues:

```bash
# Clean up old containers from alchemy dev
docker ps -a | grep -E "ralph|desktop-linux" | awk '{print $1}' | xargs -r docker rm -f

# Prune Docker system to free memory
docker system prune -f
```

Alchemy creates new Docker containers on each deploy. Old containers accumulate and fill up memory if not cleaned regularly.

## Usage

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

### Advanced: Checkpoints

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

- **Cloudflare account** with Workers enabled
- **Cloudflare peer dependencies** installed: `@cloudflare/containers`, `@cloudflare/workers-types`
- OpenCode Zen API key (`ZEN_API_KEY`)
- Alchemy CLI installed (for infrastructure management)

### Steps

1. **Set environment variables:**
   ```bash
   export ZEN_API_KEY=your_api_key
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

### Troubleshooting

| Error | Fix |
|-------|-----|
| "Container binding not set" | Verify Container binding is configured in `alchemy.run.ts` |
| Browser crashes or timeouts | Verify ZEN_API_KEY is valid: `ZEN_API_KEY` |
| Rate limit errors | Default: 60 requests/minute per IP. Wait for `retryAfter` seconds before retrying. |
| Port conflicts | Container server uses port 8081 by default. Change with: `PORT=8082 bun run container/server.ts` |

## Package Exports

ralphwiggums provides multiple exports for different use cases:

1. **Main export** (direct API usage):
   ```typescript
   import { run, doThis, createHandlers } from "ralphwiggums";
   ```

2. **Orchestrator components** (advanced usage):
   ```typescript
   import { OrchestratorDO, createPool, dispatchTasks } from "ralphwiggums";
   ```

3. **Checkpoint Durable Object** (production deployments):
   ```typescript
   import { CheckpointDO } from "ralphwiggums/checkpoint-do";
   ```

## Orchestrator API

For advanced usage with the orchestrator:

```typescript
// Queue a task
const response = await fetch('/orchestrator/queue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "Go to example.com and extract the title",
    maxIterations: 5
  })
});

// Check task status
const status = await fetch(`/orchestrator/tasks/${taskId}`);

// List all tasks
const tasks = await fetch('/orchestrator/tasks');

// Get pool status
const pool = await fetch('/orchestrator/pool');
```

## Documentation

### Core Libraries
- **Stagehand** ([docs](https://docs.stagehand.dev/v3), [GitHub](https://github.com/browserbase/stagehand)) - AI-powered browser automation
- **Effect** ([docs](https://effect.website), [GitHub](https://github.com/effect-ts/effect)) - Functional programming library
- **Hono** ([docs](https://hono.dev), [GitHub](https://github.com/honojs/hono)) - Lightweight web framework

### Reference Implementations
- **AgentCast** ([GitHub](https://github.com/acoyfellow/agentcast)) - Container-based browser automation pattern

## Tests

```bash
# Run tests (E2E tests require container server running)
bun test
```

## Version

0.0.1 - Initial release
