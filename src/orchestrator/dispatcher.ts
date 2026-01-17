/**
 * Task Dispatcher for Orchestrator
 *
 * Routes tasks from ironalarm queue to available browser containers.
 * Uses Effect-based concurrency for parallel task execution.
 */

import { Effect, Data } from "effect";
import type { ReliableScheduler, Task } from "ironalarm";
import type { BrowserPool, BrowserAutomationParams, SchedulerService } from "./types.js";
import { SessionError, OrchestratorError } from "./types.js";
import { PoolError, PoolExhaustedError } from "./pool.js";
import { findAvailableBrowser, acquireBrowser, releaseBrowser, type BrowserInstance } from "./pool.js";
import { loadSessionState, isSessionPaused, cancelExpiredPausedTasks } from "./session.js";

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
  browser: BrowserInstance
): Effect.Effect<void, DispatcherError, never> {
  return Effect.tryPromise({
    try: async () => {
      // TODO: Execute task directly on browser instance
      // For now, just succeed (will be implemented when integrating with browser pool)
      console.log(`Executing task ${task.taskId} on browser ${browser.id}`);
    },
    catch: (error) => {
      throw new DispatcherError({
        reason: `Failed to execute task on browser: ${error instanceof Error ? error.message : String(error)}`,
        taskId: task.taskId,
      });
    }
  });
}

/**
 * Dispatch tasks from the queue to available browsers
 * Skips paused tasks (only dispatches non-paused tasks)
 */
export function dispatchTasks(
  scheduler: ReliableScheduler,
  pool: BrowserPool,
  schedulerService: SchedulerService
): Effect.Effect<void, DispatcherError | PoolError | PoolExhaustedError | SessionError | OrchestratorError, never> {
  return Effect.gen(function* () {
    // Get pending tasks from ironalarm (these are queued and ready to run)
    const tasks = yield* scheduler.getTasks("pending");

    if (tasks.length === 0) {
      return; // No tasks to dispatch
    }

    // Cancel expired paused tasks
    const cancelledTaskIds = yield* cancelExpiredPausedTasks(tasks, schedulerService);
    if (cancelledTaskIds.length > 0) {
      console.log(`Cancelled ${cancelledTaskIds.length} expired paused tasks: ${cancelledTaskIds.join(", ")}`);
    }

    // Filter out paused tasks (including newly expired ones)
    const nonPausedTasks: Task[] = [];
    for (const task of tasks) {
      // Skip cancelled tasks
      if (cancelledTaskIds.includes(task.taskId)) {
        continue;
      }
      const sessionState = yield* loadSessionState(task.taskId, schedulerService);
      if (!sessionState || !isSessionPaused(sessionState)) {
        nonPausedTasks.push(task);
      }
    }

    if (nonPausedTasks.length === 0) {
      return; // All tasks are paused
    }

    // Process tasks up to available browser capacity
    const availableCapacity = pool.availableCount;

    if (availableCapacity === 0) {
      // No browsers available - log and tasks will remain queued for next dispatch cycle
      console.log(`Pool exhausted: ${nonPausedTasks.length} tasks waiting for available browsers`);
      return;
    }

    // Take only as many tasks as we have browsers
    const tasksToProcess = nonPausedTasks.slice(0, availableCapacity);

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
    // Acquire available browser
    const browser = yield* acquireBrowser(pool, task.taskId);

    try {
      yield* executeTaskOnBrowser(task, browser);
    } finally {
      yield* Effect.ignore(releaseBrowser(pool, browser.id));
    }
  });
}