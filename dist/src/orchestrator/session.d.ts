/**
 * ralphwiggums - Session State Management
 *
 * Manages task execution state, iterations, and checkpoints for orchestrator.
 * Provides clear separation between container (single prompt execution) and
 * orchestrator (multi-iteration task lifecycle).
 */
import { Effect } from "effect";
import type { SessionState, OrchestratorError } from "./types.js";
/**
 * Create initial session state for a task
 */
export declare function createSessionState(taskId: string, prompt: string, maxIterations: number): SessionState;
/**
 * Update session state after an iteration
 */
export declare function updateSessionState(state: SessionState, iteration: number, result: string, promiseCompleted: boolean): SessionState;
/**
 * Check if task should continue iterating
 */
export declare function shouldContinueIteration(state: SessionState): boolean;
/**
 * Get next iteration number
 */
export declare function getNextIteration(state: SessionState): number;
/**
 * Save session state to checkpoint
 */
export declare function saveSessionState(taskId: string, state: SessionState): Effect.Effect<void, OrchestratorError, import("./types.js").SchedulerService>;
/**
 * Load session state from checkpoint
 */
export declare function loadSessionState(taskId: string): Effect.Effect<SessionState | null, OrchestratorError, import("./types.js").SchedulerService>;
