/**
 * HTTP API Handlers for Orchestrator
 *
 * REST API endpoints for task management, queue operations, and pool monitoring.
 * All ironalarm operations use Effect.runPromise() as required.
 */
import { Hono } from "hono";
import type { ReliableScheduler } from "ironalarm";
import type { BrowserPool } from "./types.js";
/**
 * Create Hono app with orchestrator endpoints
 */
export declare function createOrchestratorHandlers(scheduler: ReliableScheduler, pool: BrowserPool): Hono;
