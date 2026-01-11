/**
 * ralphwiggums - Orchestrator Durable Object
 *
 * Effect-first browser automation orchestrator using ironalarm.
 * Manages task scheduling and session state persistence via checkpoints.
 *
 * ARCHITECTURE DECISION: Container owns browser lifecycle
 * - Container: Manages browser pool, creation/acquisition/release via /do endpoint
 * - Orchestrator: Manages task scheduling, persistence, and calls container for execution
 *
 * ITERATION CONTROL OWNERSHIP:
 * - Container: Executes single attempt (no internal iterations)
 * - Orchestrator: Manages iterations via checkpoint/resume, decides when to retry vs complete
 *
 * This enables external persistence and prevents dual iteration logic.
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
import { createPool, type BrowserPool, type BrowserInstance, startAutoScaling } from "./pool.js";
import { loadSessionState, saveSessionState, completeSessionWithPromise } from "./session.js";
import { dispatchTasks, type DispatcherError } from "./dispatcher.js";
import { createOrchestratorHandlers } from "./handlers.js";

/**
 * Orchestrator Durable Object
 *
 * Manages browser automation tasks using Effect-TS and ironalarm.
 * All operations are Effect-based for type safety and composability.
 */
export class OrchestratorDO implements DurableObject {
  private scheduler: ReliableScheduler;
  private schedulerService: SchedulerService;
  private browserPool: BrowserPool;
  private dispatchLoopRunning = false;

  constructor(private readonly state: DurableObjectState) {
    // Initialize ReliableScheduler with DO storage
    this.scheduler = new ReliableScheduler(state.storage);

    // Create SchedulerService wrapper for Effect operations
    this.schedulerService = new SchedulerService(this.scheduler);

    // Initialize browser pool with configurable size (default 5)
    const poolSize = 5; // TODO: Make configurable via environment
    this.browserPool = Effect.runSync(createPool(poolSize));

    // Register browser automation handler
    this.registerBrowserAutomationHandler();

    // Start the dispatch loop for continuous task processing
    this.startDispatchLoop();

    // Start auto-scaling for dynamic pool management
    this.startAutoScalingLoop();
  }

  /**
   * Start the auto-scaling loop for dynamic pool sizing
   */
  private startAutoScalingLoop(): void {
    const runAutoScaling = async () => {
      try {
        await Effect.runPromise(
          startAutoScaling(this.browserPool, this.scheduler)
        );
      } catch (error) {
        console.error("Auto-scaling loop error:", error instanceof Error ? error.message : String(error));
      }
    };

    runAutoScaling();
  }

  /**
   * Register the browser automation task handler
   */
  private registerBrowserAutomationHandler(): void {
    const handler = (taskId: string, params: unknown) => {
      // Capture 'this' context for the handler
      const self = this;
      return Effect.gen(function* () {
        // Access SchedulerService from Effect context
        const svc = yield* SchedulerServiceTag;

        // Load existing session state for resumability
        const existingState = yield* loadSessionState(taskId, svc);

        // TODO: Implement full browser automation logic with session state
        // This will integrate with browser pool and session management in later stories
        console.log(`Processing browser automation task ${taskId} with params:`, params);
        console.log(`Browser pool status: ${self.browserPool.availableCount} available, ${self.browserPool.busyCount} busy`);

        if (existingState) {
          console.log(`Resuming task ${taskId} from iteration ${existingState.iteration}`);
        }

        // TODO: Check for promise tag completion and update session state
        // This will be implemented when browser automation logic is added

        // For now, just succeed - full implementation comes in later stories
        return Effect.succeed(undefined);
      }).pipe(
        // Provide SchedulerService in context
        Effect.provideService(SchedulerServiceTag, self.schedulerService)
      );
    };

    // Register with ironalarm scheduler
    this.scheduler.register("browser-automation", handler);
  }

  /**
   * Handle Durable Object fetch requests
   * Uses Hono for routing and Effect.runPromise() for ironalarm operations
   */
  // @ts-expect-error - Cloudflare Durable Object fetch signature mismatch with Hono
  async fetch(request: Request): Promise<Response> {
    // Create handlers on each request (stateless Hono app)
    const handlers = createOrchestratorHandlers(
      this.scheduler,
      this.browserPool,
      () => this.getPoolStatus(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (taskId: any, params: any, options?: any): Promise<void> => 
        this.runNow(taskId, params, options),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (at: any, taskId: any, params: any, options?: any): Promise<void> => 
        Effect.runPromise(this.schedulerService.schedule(at, taskId, "browser-automation", params, options)),
      // Cancel returns boolean, wrap to void
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (taskId: any): Promise<void> => 
        Effect.runPromise(this.scheduler.cancelTask(taskId)).then(() => {})
    );

    // Delegate to Hono handlers
    return handlers.fetch(request as any);
  }

  /**
   * Start the continuous dispatch loop
   * Runs dispatchTasks periodically to process queued tasks
   */
  private startDispatchLoop(): void {
    if (this.dispatchLoopRunning) return;
    this.dispatchLoopRunning = true;

    const runDispatch = async () => {
      try {
        await Effect.runPromise(
          dispatchTasks(this.scheduler, this.browserPool)
        );
      } catch (error) {
        console.error("Dispatch loop error:", error instanceof Error ? error.message : String(error));
      }

      // Continue loop with delay
      if (this.dispatchLoopRunning) {
        setTimeout(runDispatch, 1000); // Dispatch every second
      }
    };

    runDispatch();
  }

  /**
   * Stop the dispatch loop (for testing/cleanup)
   */
  stopDispatchLoop(): void {
    this.dispatchLoopRunning = false;
  }

  /**
   * Handle Durable Object alarms
   */
  async alarm(): Promise<void> {
    // Delegate to ironalarm scheduler alarm handling
    await Effect.runPromise(this.schedulerService.alarm());

    // Run dispatch on alarm to catch any pending tasks
    await Effect.runPromise(
      dispatchTasks(this.scheduler, this.browserPool)
    ).catch(error => {
      console.error("Dispatch error during alarm:", error instanceof Error ? error.message : String(error));
    });
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

  /**
   * Get browser pool status for monitoring
   */
  getPoolStatus(): { size: number; maxSize: number; available: number; busy: number; unhealthy: number } {
    return {
      size: this.browserPool.instances.length,
      maxSize: this.browserPool.maxSize,
      available: this.browserPool.availableCount,
      busy: this.browserPool.instances.filter((i: BrowserInstance) => i.status === "busy").length,
      unhealthy: this.browserPool.instances.filter((i: BrowserInstance) => i.status === "unhealthy").length,
    };
  }
}