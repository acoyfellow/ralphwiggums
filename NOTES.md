# RalphWiggums Development Notes

## New Architecture (Jan 2026) - SvelteKit + Alchemy

### Overview
Migrated from separate workers to unified SvelteKit app with Alchemy infrastructure.

### Architecture
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
│   └── RalphContainer DO     - Browser automation    │
├─────────────────────────────────────────────────────┤
│ Container (ralph-container)                         │
│ container/server.ts                                 │
│   └── Stagehand browser     - Real browser control  │
└─────────────────────────────────────────────────────┘
```

### Dev Workflow (Two Terminals)
```bash
# Terminal 1: Container server (browser automation)
cd /Users/jordan/Desktop/ralphwiggums
source .env
PORT=8081 bun run container/server.ts

# Terminal 2: SvelteKit dev server
cd /Users/jordan/Desktop/ralphwiggums
bun run vite dev
```

### Ports
| Port | Service |
|------|---------|
| 8081 | Container server (browser automation) |
| 5173 | SvelteKit app (demo UI) |
| 1337 | API worker (handled by Alchemy) |

### Key Files
- `alchemy.run.ts` - Alchemy infrastructure definition
- `src/worker.ts` - Worker with Container binding
- `src/routes/+page.svelte` - Demo landing page
- `src/lib/ExtractionForm.svelte` - Interactive demo component
- `src/routes/api/product-research/+server.ts` - API endpoint
- `container/server.ts` - Browser automation server

### Svelte 5 Syntax (Runes)
```typescript
<script lang="ts">
  let url = $state('https://amazon.com/dp/B09V3KXJPB');
  let loading = $state(false);
  let output = $state(null);
  let error = $state(null);

  async function extract() {
    loading = true;
    // ...
  }
</script>

<button onclick={extract}>Extract Data</button>
```

### Alchemy Configuration
```typescript
// alchemy.run.ts
export const DEMO = await SvelteKit("ralphwiggums-demo", {
  bindings: {
    WORKER: worker,
    CONTAINER_URL: process.env.CONTAINER_URL ?? "http://localhost:8081",
  },
  url: true,
  adopt: true,
});
```

### Vite Config (Prevent HMR Loops)
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    watch: {
      ignored: ['**/.alchemy/**']
    }
  }
});
```

### Production Deploy
```bash
bun run deploy
```

---

## Dev Workflow Reminders (Important!)

### Docker Cleanup (Before Each New Deploy!)
```bash
# Clean up old containers from alchemy dev
docker ps -a | grep -E "ralph|desktop-linux" | awk '{print $1}' | xargs -r docker rm -f

# Prune Docker system to free memory
docker system prune -f
```
- Alchemy creates new Docker containers on each deploy
- Old containers accumulate and fill up memory
- Can crash your computer if not cleaned regularly!

### Script Consolidation
- Put reusable shell scripts in `scripts/` folder
- Don't leave ad-hoc scripts scattered around
- Name scripts descriptively (e.g., `cleanup-docker.sh`)

---

## Production Deploy Problems (Jan 2026) - BLOCKED ❌

### Current Status
| Component | Local Dev | Production |
|-----------|-----------|------------|
| Container | ✅ Working | ✅ Deployed |
| API Worker | ✅ Working | ❌ InternalError |
| Demo Worker | ✅ Working | ❌ Error 1101 |

### Root Causes

#### 1. `process.env` doesn't work in Cloudflare Workers
**File**: `src/index.ts:14`
```typescript
const CONTAINER_URL = typeof process !== "undefined" ? process.env?.CONTAINER_URL : undefined;
const USE_LOCAL_CONTAINER = CONTAINER_URL && CONTAINER_URL.trim() !== "";
```
- `process.env` is `undefined` in Workers runtime
- `CONTAINER_URL` env binding is ignored
- Worker falls through to Container binding which fails in local dev

**Fix needed**: Use `env.CONTAINER_URL` from the Hono context or Worker bindings, not `process.env`

#### 2. API Worker Fails in Production
- Changed to call container `/do` endpoint instead of `/instruction`
- But CONTAINER_URL logic is broken (see #1)
- Falls back to Container binding, which also fails

**Fix needed**: Either fix CONTAINER_URL env access, or properly configure Container binding

#### 3. Demo Worker Missing ASSETS Binding
- Demo worker expects `env.ASSETS` for static files
- But the ASSETS binding creates an R2 bucket that doesn't exist
- Results in "Assets not configured" error (500)

**Fix needed**: Either create R2 bucket, or serve static files differently

### Files Affected
- `src/index.ts` - CONTAINER_URL env access broken
- `alchemy.run.ts` - ASSETS binding incomplete for prod
- `demo/worker.ts` - Hardcoded localhost fallback

### Next Steps
1. Fix CONTAINER_URL access in `src/index.ts` using env binding
2. Configure ASSETS properly (R2 bucket or disable static files)
3. Test production deploy after fixes

---

## Dev Process (Working ✅)

### Quick Start (Two Terminals Required)
```bash
# Terminal 1: Container server (browser automation)
cd /Users/jordan/Desktop/ralphwiggums
source .env
PORT=8081 bun run --hot container/server.ts

# Terminal 2: Alchemy dev (API + Demo workers)
cd /Users/jordan/Desktop/ralphwiggums
export CONTAINER_URL=http://localhost:8081
bun run dev
```

### Ports
| Port | Service |
|------|---------|
| 8081 | Container server (browser automation) + WebSocket + SSE |
| 1337 | API worker |
| 1338 | Demo worker |

### Test
```bash
# Direct container test (returns data)
curl -X POST http://localhost:8081/do \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Extract from https://example.com: page title"}'
# Returns: {"success":true,"data":"Example Domain","iterations":1,"totalTime":5230}

# Demo worker test (calls container directly)
curl -X POST http://localhost:1338/api/product-research \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","instructions":"page title"}'
# Returns: {"success":true,"data":"Example Domain","iterations":1,"totalTime":5230}

# SSE event stream (real-time activity)
curl -N http://localhost:8081/events
```

### WebSocket Event Stream
Connect to `ws://localhost:8081` for real-time updates:

```typescript
// Event Types
type RalphEvent =
  | { type: "start"; prompt: string; timestamp: number }
  | { type: "iteration"; iteration: number; maxIterations: number; timestamp: number }
  | { type: "action"; action: string; timestamp: number }
  | { type: "log"; level: string; message: string; category?: string; timestamp: number }
  | { type: "progress"; message: string; timestamp: number }
  | { type: "extraction"; extraction: string; timestamp: number }
  | { type: "success"; data: string; iterations: number; timestamp: number }
  | { type: "error"; message: string; timestamp: number };
```

## Key Lessons Learned

### Stagehand Extraction Behavior (Jan 2025)
- **`extract()` returns `{ extraction: "text" }`** - The response object has an `extraction` property, not `text`
- **`act()` handles both actions AND extraction** - Stagehand v3's `act()` is "intelligent" - it can navigate, extract, and interact based on natural language
- **Best approach**: Use `extract()` for extraction prompts
- **Prompt format matters**: 
  - ✅ Works: "Go to URL and get all visible text"
  - ❌ Doesn't work: "Extract from URL: instructions"
  - ✅ Fixed: Auto-transform "Extract from URL: instructions" → "Go to URL and instructions"
- **Zod schema optional**: Pass `undefined` to `extract()` for raw text

### Iterative Extraction with Learning (Jan 2025)
RalphWiggums now retries up to 3 times with enhanced prompts:

```typescript
// Iteration 1: Try basic extraction
// Iteration 2: Add wait/scroll instructions
// Iteration 3: Final attempt before giving up
```

Failure detection checks for phrases like:
- "cannot extract", "only shows", "hasn't loaded", "failed to load", etc.

### Port 8080 conflict - Alchemy dev uses port 8080 for its container simulation. Our container server must use a different port (8081).

### Docker dev-envs - Docker Desktop's `com.docker.dev-envs` watchdog auto-runs scripts named `dev.*`. Scripts must avoid `dev.*` naming pattern.

### Miniflare Container Binding Limitation (Jan 2026)
Alchemy/miniflare simulates Container bindings but can't actually run containers locally. Calls to `getContainer().fetch()` fail with "Monitor failed to find container".

**Solution**: Two-terminal dev setup with `CONTAINER_URL` env var:
- Terminal 1: Run container server directly (`PORT=8081 bun run --hot container/server.ts`)
- Terminal 2: Run alchemy dev with `CONTAINER_URL=http://localhost:8081`
- The `src/index.ts` checks for `CONTAINER_URL` env var and uses direct HTTP instead of Container binding

### Demo Worker Calls Container Directly (Jan 2026)
For local dev, demo worker calls container `/do` endpoint directly (not API worker) because:
- API worker's `/instruction` endpoint only returns "TASK_COMPLETE", not extracted data
- Container's `/do` endpoint returns `{ success, data, iterations, totalTime }`
- This gives proper extraction results in the demo UI

### Extraction Result Length Bug (Jan 2026)
Container `/do` had `result.length > 50` check that filtered out short extractions like "Example Domain". Changed to `result.length > 0`.

### API Worker Data Return (Jan 2026)
Changed API worker to call container `/do` endpoint directly instead of `/instruction`:
- Old: Call `/instruction`, loop internally, return success/message only
- New: Call `/do`, container handles all logic, return success/data/message

This allows extraction results to be returned to callers.

### RalphResult Interface Updated (Jan 2026)
Added `data` field to `RalphResult`:
```typescript
export interface RalphResult {
  success: boolean;
  message: string;
  data?: unknown;        // NEW - extracted data
  iterations: number;
  checkpointId?: string;
  requestId?: string;
}
```

---

## Production Deploy Issues (Jan 2026) - SEE TOP OF FILE

### Key Learnings
1. **Workers don't have `process.env`** - Must use `env.*` bindings from Worker context
2. **CONTAINER binding requires RalphContainer class export** - Demo worker was missing this
3. **ASSETS binding needs R2 bucket** - Static file serving requires additional setup
4. **Deploying to same worker name fails** - Must delete old worker first with `wrangler delete --name ralphwiggums-demo`

---

## Future: Ralph Dashboard UI (TODO)

### Features
- **View All Ralphs** - List of all running/completed tasks with status
- **Create New** - Form to add new Ralph automation tasks
- **Pause/Resume** - Stop a running task and resume later
- **Edit Prompt Mid-Iteration** - Modify the prompt between retry attempts
- **View Iterations** - See each attempt, inputs, outputs, timing

### Architecture
```
┌─────────────────────────────────────────────────────┐
│ Ralph Dashboard (Hono Worker)                       │
├─────────────────────────────────────────────────────┤
│ /dashboard      - Main UI (HTML)                    │
│ /api/ralphs     - CRUD for Ralph tasks              │
│ /api/ralphs/:id - Get status, pause, resume, edit   │
│ /events         - SSE stream for real-time updates  │
├─────────────────────────────────────────────────────┤
│ Auth: Simple username/password (env vars)           │
│ Storage: Cloudflare Durable Objects                 │
│ Real-time: Server-Sent Events (SSE)                 │
└─────────────────────────────────────────────────────┘
```

### API Design
```typescript
// List all Ralphs
GET /api/ralphs → { ralphs: Ralph[] }

// Create new Ralph
POST /api/ralphs
{ prompt: string, maxIterations?: number, url?: string }
→ { id: string, status: "pending" | "running" | "completed" | "failed" }

// Get Ralph status
GET /api/ralphs/:id
→ { id, status, prompt, iterations: Iteration[], totalTime }

// Pause Ralph
POST /api/ralphs/:id/pause → { status: "paused" }

// Resume Ralph
POST /api/ralphs/:id/resume → { status: "running" }

// Edit prompt (only if paused)
POST /api/ralphs/:id/edit
{ prompt: string }
→ { status: "paused", updatedPrompt }

interface Iteration {
  number: number;
  input: string;
  output: string;
  startTime: number;
  endTime: number;
  success: boolean;
}
```

### UI Layout
```
┌─────────────────┬─────────────────────────────────┐
│  📋 All Ralphs  │  🟢 Running: Amazon Scraper     │
│                 │                                 │
│  🟢 Amazon      │  Prompt: Extract product info  │
│  🟡 Wikipedia   │                                 │
│  🔴 Failed      │  ┌───────────────────────────┐ │
│                 │  │ Iteration 1: ✅ Success   │ │
│  ➕ New Ralph   │  │ Iteration 2: 🔄 Running   │ │
│                 │  │ Iteration 3: ⏳ Pending   │ │
│                 │  └───────────────────────────┘ │
│                 │                                 │
│                 │  [⏸️ Pause] [✏️ Edit] [▶️ Resume]│
└─────────────────┴─────────────────────────────────┘
```

### Auth Implementation
```typescript
// Simple env-based auth for dashboard
const DASHBOARD_USER = process.env.DASHBOARD_USER || "admin";
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || "changeme";

// Hono middleware
app.use("/dashboard/*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth) return c.text("Unauthorized", 401);
  
  const [user, pass] = atob(auth.replace("Basic ", "")).split(":");
  if (user !== DASHBOARD_USER || pass !== DASHBOARD_PASS) {
    return c.text("Unauthorized", 401);
  }
  await next();
});
```

## Debugging Commands

```bash
# Kill stuck processes on port 8081
lsof -ti:8081 | xargs kill -9

# Test container directly
curl -X POST http://localhost:8081/do \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Go to example.com and get all visible text"}'

# Test SSE events
curl -N http://localhost:8081/events

# Test WebSocket (with wscat)
wscat -c ws://localhost:8081
```

### Ports
| Port | Service |
|------|---------|
| 8081 | Container server (browser automation) |
| 1337 | API worker |
| 1338 | Demo worker |

### Test
```bash
curl -X POST http://localhost:1338/api/product-research \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","instructions":"title"}'
```

## Key Lessons Learned

### Stagehand Extraction Behavior (Jan 2025)
- **`extract()` returns `{ extraction: "text" }`** - The response object has an `extraction` property, not `text`
- **`act()` handles both actions AND extraction** - Stagehand v3's `act()` is "intelligent" - it can navigate, extract, and interact based on natural language
- **Best approach**: Use `extract()` for extraction prompts
- **Prompt format matters**: 
  - ✅ Works: "Go to URL and get all visible text"
  - ❌ Doesn't work: "Extract from URL: instructions"
  - ✅ Fixed: Auto-transform "Extract from URL: instructions" → "Go to URL and instructions"
- **Zod schema optional**: Pass `undefined` to `extract()` for raw text

```typescript
// ✅ Works - act() with extraction prompt
const result = await browser.act("Go to example.com and get all visible text");

// ❌ Doesn't work - extract() with Zod schema returns null
const extracted = await browser.extract(prompt, z.object({ text: z.string() }));

// ✅ Works - extract() without schema
const extracted = await browser.extract(prompt, undefined);
// Returns: { extraction: "actual page text..." }

// ✅ Works - prompt transformation for demo worker
// "Extract from https://example.com: all visible text" 
// → "Go to https://example.com and all visible text"
```

### Port 8080 conflict - Alchemy dev uses port 8080 for its container simulation. Our container server must use a different port (8081).

### Docker dev-envs - Docker Desktop's `com.docker.dev-envs` watchdog auto-runs scripts named `dev.*`. Renamed our script to avoid conflicts.

### Miniflare doesn't bridge to local containers - In local dev, miniflare simulates Container bindings. We bypass this by having the demo worker call `http://localhost:8081` directly.

## Debugging Commands

```bash
# Kill stuck processes on port 8081
lsof -ti:8081 | xargs kill -9

# Test container directly
curl -X POST http://localhost:8081/do \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Go to example.com and get all visible text"}'
```
