# ralphwiggums

**Effect-first browser automation orchestrator with OpenCode Zen.** Queue multiple tasks, manage a pool of browsers, get results.

## Quick Start

### Library Mode

```typescript
import { createOrchestrator } from "ralphwiggums/orchestrator";

// Initialize orchestrator
const orch = await createOrchestrator(env);

// Queue multiple tasks
const task1 = await orch.enqueue("Extract product prices from amazon.com");
const task2 = await orch.enqueue("Fill contact form on example.com");
const task3 = await orch.enqueue("Screenshot dashboard", { priority: 0 }); // High priority

// Check status
const status = await orch.getStatus(task1);
// { taskId: "...", status: "running", progress: { iteration: 2, maxIterations: 10 } }

// Wait for completion
while (status.status === "running") {
  await sleep(1000);
  status = await orch.getStatus(task1);
}

// Get result
if (status.status === "completed") {
  console.log(status.result.data); // Extracted data
}
```

### HTTP API Mode

```bash
# Queue a task
curl -X POST https://your-worker.workers.dev/queue \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Extract prices from amazon.com", "priority": 1}'

# Response: {"taskId": "task_abc123"}

# Check status
curl https://your-worker.workers.dev/tasks/task_abc123

# Response:
# {
#   "taskId": "task_abc123",
#   "status": "running",
#   "harnessId": "harness_xyz",
#   "progress": { "iteration": 2, "maxIterations": 10 },
#   "checkpointId": "checkpoint_..."
# }

# List all tasks
curl https://your-worker.workers.dev/tasks?status=running

# Cancel a task
curl -X DELETE https://your-worker.workers.dev/tasks/task_abc123
```

### WebSocket Streaming

```typescript
const ws = new WebSocket("wss://your-worker.workers.dev/tasks/task_abc123/stream");

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  
  if (update.type === "task_update") {
    console.log(`Status: ${update.task.status}`);
    console.log(`Progress: ${update.task.progress.iteration}/${update.task.progress.maxIterations}`);
  }
  
  if (update.type === "task_completed") {
    console.log("Result:", update.result.data);
    ws.close();
  }
};
```

## What It Does

1. **Task Queue** - Queue unlimited tasks, execute in parallel
2. **Harness Pool** - Manages N browser instances automatically
3. **Smart Routing** - Assigns tasks to available browsers
4. **Status Tracking** - Real-time status per task
5. **Auto-Recovery** - Replaces failed browsers automatically
6. **Priority Queue** - High priority tasks execute first

## Architecture

```
┌─────────────────────┐
│   API Worker        │
│  (Hono + Handlers)  │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Orchestrator DO    │ (central coordinator)
│  - Pool Manager     │
│  - Task Queue       │
│  - Dispatcher       │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼───┐    ┌───▼───┐
│ Pool  │    │ Queue │ (DO storage)
│ Mgr   │    │ DO    │
└───┬───┘    └───────┘
    │
┌───▼──────────────────────┐
│  Container Pool (N=5)     │
│  ┌────┐ ┌────┐ ┌────┐    │
│  │ C1 │ │ C2 │ │ C5 │    │
│  └─┬──┘ └─┬──┘ └─┬──┘    │
└───┼───────┼───────┼───────┘
    │       │       │
┌───▼──┐ ┌─▼──┐ ┌─▼──┐
│ Br 1 │ │Br 2│ │Br 5│
└──────┘ └────┘ └────┘
```

## API Reference

### Orchestrator (Library Mode)

```typescript
import { createOrchestrator } from "ralphwiggums/orchestrator";

interface Orchestrator {
  // Queue a task
  enqueue(
    prompt: string,
    options?: {
      maxIterations?: number;
      timeout?: number;
      priority?: number; // 0=high, 1=medium, 2=low (default: 1)
    }
  ): Promise<string>; // Returns taskId

  // Get task status
  getStatus(taskId: string): Promise<TaskStatus>;

  // List tasks
  listTasks(options?: {
    status?: "queued" | "running" | "completed" | "failed";
    limit?: number;
  }): Promise<TaskStatus[]>;

  // Cancel task
  cancel(taskId: string): Promise<void>;

  // Pool management
  getPoolStatus(): Promise<{ size: number; available: number; busy: number }>;
  scalePool(size: number): Promise<void>;
}

interface TaskStatus {
  taskId: string;
  status: "queued" | "running" | "completed" | "failed";
  prompt: string;
  harnessId?: string;
  progress: {
    iteration: number;
    maxIterations: number;
  };
  checkpointId?: string;
  result?: RalphResult;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
```

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/queue` | Queue a new task |
| GET | `/tasks/:taskId` | Get task status |
| GET | `/tasks` | List tasks (query: `?status=running`) |
| DELETE | `/tasks/:taskId` | Cancel a task |
| GET | `/orchestrator/pool` | Get pool status |
| POST | `/orchestrator/scale` | Scale pool size |
| WS | `/tasks/:taskId/stream` | WebSocket stream for task updates |

### Request/Response Examples

**Queue Task:**
```bash
POST /queue
Content-Type: application/json

{
  "prompt": "Extract product prices from amazon.com",
  "options": {
    "maxIterations": 10,
    "timeout": 300000
  },
  "priority": 0
}

# Response: 200 OK
{
  "taskId": "task_abc123"
}
```

**Get Status:**
```bash
GET /tasks/task_abc123

# Response: 200 OK
{
  "taskId": "task_abc123",
  "status": "running",
  "prompt": "Extract product prices from amazon.com",
  "harnessId": "harness_xyz",
  "progress": {
    "iteration": 3,
    "maxIterations": 10
  },
  "checkpointId": "checkpoint_def456",
  "createdAt": 1704567890000,
  "updatedAt": 1704567895000
}
```

**List Tasks:**
```bash
GET /tasks?status=running&limit=10

# Response: 200 OK
{
  "tasks": [
    {
      "taskId": "task_abc123",
      "status": "running",
      "progress": { "iteration": 3, "maxIterations": 10 }
    },
    {
      "taskId": "task_def456",
      "status": "running",
      "progress": { "iteration": 1, "maxIterations": 10 }
    }
  ],
  "total": 2
}
```

**Pool Status:**
```bash
GET /orchestrator/pool

# Response: 200 OK
{
  "size": 5,
  "available": 2,
  "busy": 3,
  "unhealthy": 0
}
```

**Scale Pool:**
```bash
POST /orchestrator/scale
Content-Type: application/json

{
  "size": 10
}

# Response: 200 OK
{
  "success": true,
  "newSize": 10
}
```

## Usage Examples

### Example 1: Batch Processing

```typescript
import { createOrchestrator } from "ralphwiggums/orchestrator";

const orch = await createOrchestrator(env);

// Queue 100 tasks
const urls = [...]; // 100 URLs
const taskIds = await Promise.all(
  urls.map(url => 
    orch.enqueue(`Extract title and price from ${url}`, { priority: 1 })
  )
);

// Poll for completion
const results = await Promise.all(
  taskIds.map(async (taskId) => {
    while (true) {
      const status = await orch.getStatus(taskId);
      if (status.status === "completed") {
        return status.result;
      }
      if (status.status === "failed") {
        throw new Error(status.error);
      }
      await sleep(2000);
    }
  })
);

console.log(`Processed ${results.length} tasks`);
```

### Example 2: Priority Queue

```typescript
// High priority task (executes first)
const urgent = await orch.enqueue("Critical extraction", { priority: 0 });

// Normal tasks (execute after high priority)
const normal1 = await orch.enqueue("Task 1", { priority: 1 });
const normal2 = await orch.enqueue("Task 2", { priority: 1 });

// Low priority (executes last)
const low = await orch.enqueue("Background task", { priority: 2 });
```

### Example 3: WebSocket Monitoring

```typescript
// Monitor all running tasks
const running = await orch.listTasks({ status: "running" });

for (const task of running) {
  const ws = new WebSocket(`wss://worker.workers.dev/tasks/${task.taskId}/stream`);
  
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    console.log(`Task ${task.taskId}: ${update.task.status}`);
    
    if (update.type === "task_completed") {
      console.log("Result:", update.result.data);
      ws.close();
    }
  };
}
```

### Example 4: Auto-Scaling

```typescript
// Monitor queue depth and scale pool
setInterval(async () => {
  const queued = await orch.listTasks({ status: "queued" });
  const pool = await orch.getPoolStatus();
  
  // If queue is backing up, scale up
  if (queued.length > pool.available * 2) {
    const newSize = Math.min(pool.size + 2, 20); // Max 20
    await orch.scalePool(newSize);
    console.log(`Scaled pool to ${newSize}`);
  }
  
  // If queue is empty, scale down
  if (queued.length === 0 && pool.size > 5) {
    await orch.scalePool(pool.size - 1);
    console.log(`Scaled pool down to ${pool.size - 1}`);
  }
}, 30000); // Check every 30s
```

### Example 5: Error Handling

```typescript
const taskId = await orch.enqueue("Extract data");

try {
  const status = await waitForCompletion(orch, taskId);
  console.log("Success:", status.result.data);
} catch (error) {
  if (error instanceof TaskFailedError) {
    console.error("Task failed:", error.message);
    // Retry with different prompt
    const retryId = await orch.enqueue("Extract data (retry)", { priority: 0 });
  }
}
```

## Configuration

### Environment Variables

```bash
# Pool configuration
RALPH_POOL_SIZE=5              # Number of containers (default: 5)
RALPH_POOL_MAX=20              # Maximum pool size (default: 20)
RALPH_POOL_HEALTH_CHECK=30000  # Health check interval ms (default: 30000)

# Queue configuration
RALPH_QUEUE_MAX=1000           # Max queued tasks (default: 1000)
RALPH_QUEUE_PRIORITY=true      # Enable priority queuing (default: true)

# Dispatcher configuration
RALPH_DISPATCH_INTERVAL=1000   # Dequeue check interval ms (default: 1000)
RALPH_DISPATCH_CONCURRENT=5   # Max concurrent dispatches (default: 5)

# Existing
RALPH_API_KEY=...              # API key for auth (optional)
RALPH_MAX_CONCURRENT=5         # Legacy: now handled by pool
RALPH_REQUEST_TIMEOUT=300000   # Task timeout ms (default: 300000)
RALPH_DEBUG=false              # Debug logging
```

## Backward Compatibility

The original `/do` endpoint still works for single-task execution:

```typescript
// Old way (still works)
const result = await run("Extract data");

// New way (orchestrator)
const taskId = await orch.enqueue("Extract data");
const status = await orch.getStatus(taskId);
```

## Migration Guide

### From Single-Task to Orchestrator

**Before:**
```typescript
const result = await run("Extract data");
```

**After:**
```typescript
const orch = await createOrchestrator(env);
const taskId = await orch.enqueue("Extract data");
const status = await orch.getStatus(taskId);
```

### HTTP API Migration

**Before:**
```bash
POST /do
{ "prompt": "..." }
→ Immediate response with result
```

**After:**
```bash
POST /queue
{ "prompt": "..." }
→ { "taskId": "..." }

GET /tasks/:taskId
→ { "status": "running", ... }
```

## Performance

- **Queue Capacity**: 1000+ tasks
- **Pool Size**: 5-20 containers (configurable)
- **Task Assignment**: < 100ms latency
- **Status Queries**: < 50ms
- **Throughput**: 50+ tasks/minute (with 5-container pool)

## Error Handling

```typescript
type OrchestratorError =
  | TaskNotFoundError      // Task ID doesn't exist
  | PoolExhaustedError     // All harnesses busy, queue full
  | HarnessUnhealthyError  // Container failed health check
  | QueueFullError         // Queue at max capacity
  | InvalidPriorityError   // Priority out of range
```

## Examples

See `examples/` directory:
- `batch-processing.ts` - Process 100 URLs in parallel
- `priority-queue.ts` - High/medium/low priority tasks
- `websocket-monitor.ts` - Real-time task monitoring
- `auto-scaling.ts` - Dynamic pool scaling
- `error-handling.ts` - Comprehensive error handling

## License

MIT

