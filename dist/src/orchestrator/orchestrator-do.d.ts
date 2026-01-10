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
import type { BrowserAutomationParams } from "./types.js";
/**
 * Orchestrator Durable Object
 *
 * Manages browser automation tasks using Effect-TS and ironalarm.
 * All operations are Effect-based for type safety and composability.
 */
export declare class OrchestratorDO implements DurableObject {
    private readonly state;
    private scheduler;
    private schedulerService;
    constructor(state: DurableObjectState);
    /**
     * Register the browser automation task handler
     */
    private registerBrowserAutomationHandler;
    /**
     * Handle Durable Object fetch requests
     */
    fetch(request: Request): Response | Promise<Response>;
    /**
     * Handle Durable Object alarms
     */
    alarm(): Promise<void>;
    /**
     * Queue a browser automation task immediately
     */
    runNow(taskId: string, params: BrowserAutomationParams, options?: {
        priority?: number;
    }): Promise<void>;
    /**
     * Schedule a browser automation task for later
     */
    schedule(at: Date | number, taskId: string, params: BrowserAutomationParams, options?: {
        priority?: number;
    }): Promise<void>;
}
