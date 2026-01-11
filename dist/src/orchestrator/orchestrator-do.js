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
import { Effect, Data } from "effect";
import { ReliableScheduler } from "ironalarm";
import { SchedulerService, SchedulerServiceTag } from "./types.js";
/**
 * Orchestrator Durable Object
 *
 * Manages browser automation tasks using Effect-TS and ironalarm.
 * All operations are Effect-based for type safety and composability.
 */
export class OrchestratorDO {
    state;
    scheduler;
    schedulerService;
    constructor(state) {
        this.state = state;
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
    registerBrowserAutomationHandler() {
        const handler = (taskId, params) => {
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
            Effect.provideService(SchedulerServiceTag, this.schedulerService));
        };
        // Register with ironalarm scheduler
        this.scheduler.register("browser-automation", handler);
    }
    /**
     * Handle Durable Object fetch requests
     */
    // @ts-ignore - Type mismatch due to global Response vs CF Response, will be fixed in story 013
    fetch(request) {
        // TODO: Implement HTTP API handlers in story 013
        return new Response("OrchestratorDO - Not implemented yet", { status: 501 });
    }
    /**
     * Handle Durable Object alarms
     */
    async alarm() {
        // Delegate to ironalarm scheduler alarm handling
        await Effect.runPromise(this.schedulerService.alarm());
    }
    /**
     * Queue a browser automation task immediately
     */
    async runNow(taskId, params, options) {
        await Effect.runPromise(this.schedulerService.runNow(taskId, "browser-automation", params, options));
    }
    /**
     * Schedule a browser automation task for later
     */
    async schedule(at, taskId, params, options) {
        await Effect.runPromise(this.schedulerService.schedule(at, taskId, "browser-automation", params, options));
    }
}
//# sourceMappingURL=orchestrator-do.js.map