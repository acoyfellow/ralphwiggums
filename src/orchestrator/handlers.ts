/**
 * HTTP API Handlers for Orchestrator
 *
 * REST API endpoints for task management, queue operations, and pool monitoring.
 * All ironalarm operations use Effect.runPromise() as required.
 */

import { Hono } from "hono";
import { Effect, Stream } from "effect";
import type { ReliableScheduler } from "ironalarm";
import type { BrowserPool, BrowserAutomationParams } from "./types.js";
import { SchedulerService } from "./types.js";
import { formatSseEvent, createSseEvent, streamingService } from "./streaming.js";

// ============================================================================
// API Response Types
// ============================================================================

interface TaskResponse {
  taskId: string;
  taskName: string;
  status: string;
  scheduledAt: number;
  startedAt?: number;
  priority?: number;
}

interface PoolStatusResponse {
  size: number;
  available: number;
  busy: number;
  unhealthy: number;
}

interface ErrorResponse {
  error: string;
  tag: string;
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * Create Hono app with orchestrator endpoints
 */
export function createOrchestratorHandlers(
  scheduler: ReliableScheduler,
  pool: BrowserPool,
  getPoolStatus: () => { size: number; maxSize: number; available: number; busy: number; unhealthy: number },
  runNow: (taskId: string, params: BrowserAutomationParams, options?: { priority?: number }) => Promise<void>,
  schedule: (at: Date | number, taskId: string, params: BrowserAutomationParams, options?: { priority?: number }) => Promise<void>,
  cancelTask: (taskId: string) => Promise<void>
): Hono {
  const app = new Hono();

  // CORS middleware
  app.use("/*", async (c, next) => {
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }
    await next();
  });

  // POST /orchestrator/queue - Queue new browser automation task
  app.post("/orchestrator/queue", async (c) => {
    try {
      const body = await c.req.json() as {
        prompt: string;
        maxIterations?: number;
        timeout?: number;
        resumeFrom?: string;
        priority?: number;
      };

      const taskId = crypto.randomUUID();
      const params: BrowserAutomationParams = {
        prompt: body.prompt,
        maxIterations: body.maxIterations,
        timeout: body.timeout,
        resumeFrom: body.resumeFrom,
      };

      await Effect.runPromise(
        scheduler.runNow(taskId, "browser-automation", params, {
          priority: body.priority
        })
      );

      return c.json({ taskId, status: "queued" });
    } catch (error) {
      return c.json(createErrorResponse(error), { status: 500 });
    }
  });

  // GET /orchestrator/tasks/:taskId - Get specific task
  app.get("/orchestrator/tasks/:taskId", async (c) => {
    try {
      const taskId = c.req.param("taskId");

      const task = await Effect.runPromise(scheduler.getTask(taskId));

      if (!task) {
        return c.json({ error: "Task not found", tag: "TaskNotFound" }, { status: 404 });
      }

      const response: TaskResponse = {
        taskId: task.taskId,
        taskName: task.taskName,
        status: task.status,
        scheduledAt: task.scheduledAt,
        startedAt: task.startedAt,
        priority: task.priority,
      };

      return c.json(response);
    } catch (error) {
      return c.json(createErrorResponse(error), { status: 500 });
    }
  });

  // GET /orchestrator/tasks - List tasks (optional status filter)
  app.get("/orchestrator/tasks", async (c) => {
    try {
      const status = c.req.query("status") as any;

      const tasks = await Effect.runPromise(scheduler.getTasks(status));

      const response: TaskResponse[] = tasks.map(task => ({
        taskId: task.taskId,
        taskName: task.taskName,
        status: task.status,
        scheduledAt: task.scheduledAt,
        startedAt: task.startedAt,
        priority: task.priority,
      }));

      return c.json(response);
    } catch (error) {
      return c.json(createErrorResponse(error), { status: 500 });
    }
  });

  app.delete("/orchestrator/tasks/:taskId", async (c) => {
    try {
      const taskId = c.req.param("taskId");

      const cancelled = await Effect.runPromise(scheduler.cancelTask(taskId));

      return c.json({ taskId, cancelled });
    } catch (error) {
      return c.json(createErrorResponse(error), { status: 500 });
    }
  });

  // GET /orchestrator/pool - Get pool status
  app.get("/orchestrator/pool", async (c) => {
    const response: PoolStatusResponse = {
      size: pool.instances.length,
      available: pool.availableCount,
      busy: pool.instances.filter(i => i.status === "busy").length,
      unhealthy: pool.instances.filter(i => i.status === "unhealthy").length,
    };

    return c.json(response);
  });

  // GET /orchestrator/tasks/:taskId/stream - SSE stream for task events
  app.get("/orchestrator/tasks/:taskId/stream", async (c) => {
    const taskId = c.req.param("taskId");

    // Check if listener can be added
    if (!streamingService.canAddListener(taskId)) {
      return c.json(
        { error: "Too many listeners for this task", tag: "ListenerLimit" },
        { status: 429 }
      );
    }

    streamingService.addListener(taskId);

    const body = new ReadableStream({
      start(controller) {
        // Send initial event
        const queuedEvent = formatSseEvent(
          createSseEvent("queued", taskId, { message: "Task queued" })
        );
        controller.enqueue(new TextEncoder().encode(queuedEvent));

        // Subscribe to task updates (simplified - would need actual task event emitter)
        // For now, send periodic heartbeat until task completes
        const heartbeatInterval = setInterval(() => {
          const event = formatSseEvent(
            createSseEvent("checkpoint", taskId, { message: "Task in progress" })
          );
          try {
            controller.enqueue(new TextEncoder().encode(event));
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 5000);

        // Cleanup on close
        c.req.raw.signal.addEventListener("abort", () => {
          clearInterval(heartbeatInterval);
          streamingService.removeListener(taskId);
        });
      },
    });

    return c.newResponse(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  });

  app.post("/orchestrator/scale", async (c) => {
    return c.json({ message: "Pool scaling not yet implemented" }, { status: 501 });
  });

  return app;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createErrorResponse(error: unknown): ErrorResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorTag = (error as any)?._tag || "UnknownError";

  return {
    error: errorMessage,
    tag: errorTag,
  };
}