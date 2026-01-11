/**
 * HTTP API Handlers for Orchestrator
 *
 * REST API endpoints for task management, queue operations, and pool monitoring.
 * All ironalarm operations use Effect.runPromise() as required.
 */

import { Hono } from "hono";
import { Effect } from "effect";
import type { ReliableScheduler } from "ironalarm";
import type { BrowserPool, BrowserAutomationParams } from "./types.js";
import { SchedulerService } from "./types.js";

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
  pool: BrowserPool
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