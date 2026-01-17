/**
 * ralphwiggums - Orchestrator Types
 *
 * Effect-first browser automation orchestrator with ironalarm integration.
 * Defines types for task scheduling, browser automation, and durable object state.
 *
 * ARCHITECTURE: Container manages browser lifecycle, orchestrator manages scheduling.
 */

import { Effect, Data, Context } from "effect";
import type { ReliableScheduler, Task, TaskHandler } from "ironalarm";
import type { DurableObjectState, DurableObjectStorage } from "@cloudflare/workers-types";

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
  browser?: import("playwright").Browser;
  context?: import("playwright").BrowserContext;
  page?: import("playwright").Page;
}

export interface BrowserPool {
  instances: BrowserInstance[];
  maxSize: number;
  availableCount: number;
  busyCount: number;
  unhealthyCount: number;
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionState {
  taskId: string;
  iteration: number;
  prompt: string;
  completionPromise?: string;
  checkpointId?: string;
  lastUpdated: number;
  maxIterations: number;
  completed?: boolean;
  paused?: boolean;
  pauseReason?: string;
  pauseRequestedAt?: number;
  pauseResumeToken?: string;
  pauseTimeout?: number;
}

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

export class SessionError extends Data.TaggedError("SessionError")<{
  reason: string;
  taskId: string;
}> {}

// ============================================================================
// Handler Types
// ============================================================================

export type BrowserAutomationHandler = (
  taskId: string,
  params: BrowserAutomationParams
) => Effect.Effect<void, BrowserAutomationError, never>;

// ============================================================================
// Scheduler Service (ironalarm integration)
// ============================================================================

export class SchedulerService {
  constructor(readonly scheduler: ReliableScheduler) {}

  schedule(
    at: Date | number,
    taskId: string,
    taskName: string,
    params?: unknown,
    options?: { priority?: number }
  ): Effect.Effect<void, OrchestratorError> {
    return this.scheduler.schedule(at, taskId, taskName, params, options) as any;
  }

  runNow(
    taskId: string,
    taskName: string,
    params?: unknown,
    options?: { maxRetries?: number; priority?: number }
  ): Effect.Effect<void, OrchestratorError> {
    return this.scheduler.runNow(taskId, taskName, params, options) as any;
  }

  checkpoint(
    taskId: string,
    key: string,
    value: unknown
  ): Effect.Effect<void, OrchestratorError> {
    return this.scheduler.checkpoint(taskId, key, value) as any;
  }

  getCheckpoint(
    taskId: string,
    key: string
  ): Effect.Effect<unknown, OrchestratorError> {
    return this.scheduler.getCheckpoint(taskId, key) as any;
  }

  getTask(taskId: string): Effect.Effect<Task | undefined, OrchestratorError> {
    return this.scheduler.getTask(taskId) as any;
  }

  getTasks(status?: Task["status"]): Effect.Effect<Task[], OrchestratorError> {
    return this.scheduler.getTasks(status) as any;
  }

  cancelTask(taskId: string): Effect.Effect<boolean, OrchestratorError> {
    return this.scheduler.cancelTask(taskId) as any;
  }

  alarm(): Effect.Effect<void, OrchestratorError> {
    return this.scheduler.alarm() as any;
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

// ============================================================================
// Pause Tag Detection
// ============================================================================

const PAUSE_TAG_REGEX = /<pause>(.*?)<\/pause>/gi;

export function detectPauseTag(response: string): string | null {
  const match = PAUSE_TAG_REGEX.exec(response);
  if (match) {
    return match[1];
  }
  return null;
}

export const DEFAULT_PAUSE_TIMEOUT = 3600000; // 1 hour in milliseconds
