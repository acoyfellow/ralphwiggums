/**
 * ralphwiggums - Orchestrator Types
 *
 * Effect-first browser automation orchestrator with ironalarm integration.
 */

import { Effect, Data, Context } from "effect";
import type { ReliableScheduler, Task, TaskHandler } from "ironalarm";
import type { DurableObjectState, DurableObjectStorage } from "@cloudflare/workers-types";

// ============================================================================
// Errors
// ============================================================================

export class OrchestratorError extends Data.TaggedError("OrchestratorError")<{
  reason: string;
  taskId?: string;
}> {}

export class BrowserAutomationError extends Data.TaggedError("BrowserAutomationError")<{
  taskId: string;
  reason: string;
  stage: "navigation" | "action" | "extraction" | "checkpoint";
}> {}

export class PoolError extends Data.TaggedError("PoolError")<{
  reason: string;
  browserId?: string;
}> {}

export class DispatcherError extends Data.TaggedError("DispatcherError")<{
  reason: string;
  taskId?: string;
}> {}

// ============================================================================
// Task Types
// ============================================================================

export interface BrowserAutomationParams {
  prompt: string;
  maxIterations?: number;
  timeout?: number;
  resumeFrom?: string;
}

export interface BrowserAutomationResult {
  success: boolean;
  message: string;
  data?: unknown;
  iterations: number;
  checkpointId?: string;
}

export type TaskParams = BrowserAutomationParams;

// ============================================================================
// Orchestrator State
// ============================================================================

export interface OrchestratorDOState {
  storage: DurableObjectStorage;
}

// ============================================================================
// Pool Types
// ============================================================================

export interface BrowserInstance {
  id: string;
  status: "available" | "busy" | "unhealthy";
  lastHealthCheck: number;
  currentTaskId?: string;
  url?: string;
}

export interface BrowserPool {
  instances: BrowserInstance[];
  maxSize: number;
  availableCount: number;
  busyCount: number;
  unhealthyCount: number;
}

// ============================================================================
// Session Types (for promise tag detection)
// ============================================================================

export interface SessionState {
  taskId: string;
  iteration: number;
  prompt: string;
  completionPromise: string;
  maxIterations: number;
  checkpointId?: string;
  completed: boolean;
  url?: string;
}

// ============================================================================
// Handler Types
// ============================================================================

export type BrowserAutomationHandler = (
  taskId: string,
  params: BrowserAutomationParams
) => Effect.Effect<void, BrowserAutomationError, never>;

// ============================================================================
// Scheduler Context (ironalarm integration)
// ============================================================================

/**
 * Effect context for accessing scheduler operations.
 * All ironalarm methods return Promise, so we wrap with Effect.
 */
export class SchedulerService {
  constructor(
    readonly scheduler: ReliableScheduler
  ) {}

  schedule(
    at: Date | number,
    taskId: string,
    taskName: string,
    params?: unknown,
    options?: { priority?: number }
  ): Effect.Effect<void, OrchestratorError> {
    return Effect.tryPromise({
      try: () => this.scheduler.schedule(at, taskId, taskName, params, options),
      catch: (e) =>
        new OrchestratorError({
          reason: e instanceof Error ? e.message : "schedule failed",
        }),
    });
  }

  runNow(
    taskId: string,
    taskName: string,
    params?: unknown,
    options?: { maxRetries?: number; priority?: number }
  ): Effect.Effect<void, OrchestratorError> {
    return Effect.tryPromise({
      try: () => this.scheduler.runNow(taskId, taskName, params, options),
      catch: (e) =>
        new OrchestratorError({
          reason: e instanceof Error ? e.message : "runNow failed",
        }),
    });
  }

  checkpoint(
    taskId: string,
    key: string,
    value: unknown
  ): Effect.Effect<void, OrchestratorError> {
    return Effect.tryPromise({
      try: () => this.scheduler.checkpoint(taskId, key, value),
      catch: (e) =>
        new OrchestratorError({
          reason: e instanceof Error ? e.message : "checkpoint failed",
        }),
    });
  }

  getCheckpoint(
    taskId: string,
    key: string
  ): Effect.Effect<unknown, OrchestratorError> {
    return Effect.tryPromise({
      try: () => this.scheduler.getCheckpoint(taskId, key),
      catch: (e) =>
        new OrchestratorError({
          reason: e instanceof Error ? e.message : "getCheckpoint failed",
        }),
    });
  }

  getTask(taskId: string): Effect.Effect<Task | undefined, OrchestratorError> {
    return Effect.tryPromise({
      try: () => this.scheduler.getTask(taskId),
      catch: (e) =>
        new OrchestratorError({
          reason: e instanceof Error ? e.message : "getTask failed",
        }),
    });
  }

  getTasks(status?: Task["status"]): Effect.Effect<Task[], OrchestratorError> {
    return Effect.tryPromise({
      try: () => this.scheduler.getTasks(status),
      catch: (e) =>
        new OrchestratorError({
          reason: e instanceof Error ? e.message : "getTasks failed",
        }),
    });
  }

  cancelTask(taskId: string): Effect.Effect<boolean, OrchestratorError> {
    return Effect.tryPromise({
      try: () => this.scheduler.cancelTask(taskId),
      catch: (e) =>
        new OrchestratorError({
          reason: e instanceof Error ? e.message : "cancelTask failed",
        }),
    });
  }

  alarm(): Effect.Effect<void, OrchestratorError> {
    return Effect.tryPromise({
      try: () => this.scheduler.alarm(),
      catch: (e) =>
        new OrchestratorError({
          reason: e instanceof Error ? e.message : "alarm failed",
        }),
    });
  }

  register(taskName: string, handler: TaskHandler): void {
    this.scheduler.register(taskName, handler);
  }
}

/** Effect service tag for SchedulerService */
export const SchedulerServiceTag = Context.GenericTag<SchedulerService>("@ralphwiggums/SchedulerService");

// ============================================================================
// Promise Tag Detection
// ============================================================================

const PROMISE_TAG_REGEX = /<promise>(.*?)<\/promise>/gi;

export function detectPromiseTag(response: string): string | null {
  const match = PROMISE_TAG_REGEX.exec(response);
  if (match) {
    return match[1];
  }
  return null;
}

export const DEFAULT_COMPLETION_PROMISE = "TASK_COMPLETE";
