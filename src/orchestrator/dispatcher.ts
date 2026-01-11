/**
 * Task Dispatcher for Orchestrator
 *
 * Routes tasks from ironalarm queue to available browser containers.
 * Uses Effect-based concurrency for parallel task execution.
 */

import { Effect, Data } from "effect";
import type { ReliableScheduler, Task } from "ironalarm";
import type { BrowserPool, BrowserAutomationParams } from "./types.js";
import { PoolError, PoolExhaustedError } from "./pool.js";
import { findAvailableBrowser, markBrowserBusy, markBrowserAvailable } from "./pool.js";

// ============================================================================
// Errors
// ============================================================================

export class DispatcherError extends Data.TaggedError("DispatcherError")<{
  reason: string;
  taskId?: string;
}> {}

// ============================================================================
// Task Execution
// ============================================================================

/**
 * Execute a single task on a browser container
 */
function executeTaskOnBrowser(
  task: Task,
  browserUrl: string
): Effect.Effect<void, DispatcherError, never> {
  return Effect.gen(function* () {
    const params = task.params as BrowserAutomationParams;

    // Call container /do endpoint
    const response = yield* Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${browserUrl}/do`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });

        if (!res.ok) {
          throw new Error(`Container error: ${res.status} ${res.statusText}`);
        }

        return await res.json();
      },
      catch: (error: unknown) => {
        throw new Error(`Task execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Check for promise tag completion
    const resultText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const hasPromiseTag = /<promise>(.*?)<\/promise>/gi.test(resultText);

    if (hasPromiseTag) {
      // Task completed successfully
      return;
    }

    if (!response.success) {
      yield* Effect.fail(new DispatcherError({
        reason: `Task failed: ${response.error || response.message}`,
        taskId: task.taskId
      }));
    }

    // Task completed without promise tag - may need retry
    return;
  });
}

/**
 * Dispatch tasks from the queue to available browsers
 */
export function dispatchTasks(
  scheduler: ReliableScheduler,
  pool: BrowserPool
): Effect.Effect<void, DispatcherError | PoolError | PoolExhaustedError, never> {
  return Effect.gen(function* () {
    // Get pending tasks from ironalarm (these are queued and ready to run)
    const tasks = yield* scheduler.getTasks("pending");

    if (tasks.length === 0) {
      return; // No tasks to dispatch
    }

    // Process tasks up to available browser capacity
    const availableCapacity = pool.availableCount;

    if (availableCapacity === 0) {
      // No browsers available - tasks will remain queued
      return;
    }

    // Take only as many tasks as we have browsers
    const tasksToProcess = tasks.slice(0, availableCapacity);

    // Execute tasks concurrently
    yield* Effect.all(
      tasksToProcess.map(task => dispatchSingleTask(task, pool)),
      { concurrency: availableCapacity }
    );
  });
}

/**
 * Dispatch a single task to an available browser
 */
function dispatchSingleTask(
  task: Task,
  pool: BrowserPool
): Effect.Effect<void, DispatcherError | PoolError | PoolExhaustedError, never> {
  return Effect.gen(function* () {
    // Find available browser
    const browser = yield* findAvailableBrowser(pool);

    // Mark browser as busy
    yield* markBrowserBusy(pool, browser.id, task.taskId);

    try {
      yield* executeTaskOnBrowser(task, browser.url!);
    } finally {
      yield* Effect.ignore(markBrowserAvailable(pool, browser.id));
    }
  });
}