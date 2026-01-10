/**
 * ralphwiggums - Orchestrator Durable Object
 *
 * Effect-first browser automation orchestrator using ironalarm.
 * Manages task scheduling, browser pool, and session state persistence.
 *
 * ITERATION CONTROL OWNERSHIP:
 * - Container: Executes single prompt with configurable maxIterations
 * - Orchestrator: Manages overall task lifecycle, checkpoints, and decides when to retry vs complete
 *
 * This separation prevents dual iteration logic and enables external checkpointing.
 */

import type { DurableObject, DurableObjectState, Request } from "@cloudflare/workers-types";
import { Effect, Data } from "effect";
import { ReliableScheduler } from "ironalarm";
import type {
  BrowserAutomationHandler,
  BrowserAutomationParams,
  BrowserAutomationError,
  OrchestratorError,
} from "./types.js";
import { SchedulerService, SchedulerServiceTag } from "./types.js";

/**
 * Orchestrator Durable Object
 *
 * Manages browser automation tasks using Effect-TS and ironalarm.
 * All operations are Effect-based for type safety and composability.
 */
export class OrchestratorDO implements DurableObject {
  private scheduler: ReliableScheduler;
  private schedulerService: SchedulerService;

  constructor(private readonly state: DurableObjectState) {
    // Initialize ReliableScheduler with DO storage
    this.scheduler = new ReliableScheduler(state.storage);

    // Create SchedulerService wrapper for Effect operations
    this.schedulerService = new SchedulerService(this.scheduler);

    // Register browser automation handler
    this.registerBrowserAutomationHandler();
  }

  /**
   * Register the browser automation task handler
   */
  private registerBrowserAutomationHandler(): void {
    const handler = (taskId: string, params: unknown) => {
      return Effect.gen(function* () {
        // Access SchedulerService from Effect context
        const svc = yield* SchedulerServiceTag;

        // TODO: Implement browser automation logic
        // This will be expanded in future stories (pool management, session state, etc.)
        console.log(`Processing browser automation task ${taskId} with params:`, params);

        // For now, just succeed - full implementation comes in later stories
        return Effect.succeed(undefined);
      }).pipe(
        // Provide SchedulerService in context
        Effect.provideService(SchedulerServiceTag, this.schedulerService)
      );
    };

    // Register with ironalarm scheduler
    this.scheduler.register("browser-automation", handler);
  }

  /**
   * Handle Durable Object fetch requests
   */
  // @ts-ignore - Type mismatch due to global Response vs CF Response, will be fixed in story 013
  fetch(request: Request): Response | Promise<Response> {
    // TODO: Implement HTTP API handlers in story 013
    return new Response("OrchestratorDO - Not implemented yet", { status: 501 });
  }

  /**
   * Handle Durable Object alarms
   */
  async alarm(): Promise<void> {
    // Delegate to ironalarm scheduler alarm handling
    await Effect.runPromise(this.schedulerService.alarm());
  }

  /**
   * Queue a browser automation task immediately
   */
  async runNow(
    taskId: string,
    params: BrowserAutomationParams,
    options?: { priority?: number }
  ): Promise<void> {
    await Effect.runPromise(
      this.schedulerService.runNow(taskId, "browser-automation", params, options)
    );
  }

  /**
   * Schedule a browser automation task for later
   */
  async schedule(
    at: Date | number,
    taskId: string,
    params: BrowserAutomationParams,
    options?: { priority?: number }
  ): Promise<void> {
    await Effect.runPromise(
      this.schedulerService.schedule(at, taskId, "browser-automation", params, options)
    );
  }
}