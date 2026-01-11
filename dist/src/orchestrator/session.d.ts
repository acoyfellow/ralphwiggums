/**
 * Session State Management for Orchestrator
 *
 * Manages task execution state, iterations, and checkpoints for resumable browser automation.
 * Uses ironalarm SchedulerService for persistence.
 */
import { Effect } from "effect";
import type { SessionState, SchedulerService } from "./types.js";
import { SessionError } from "./types.js";
/**
 * Update session iteration count
 */
/**
 * Update session iteration count
 */
export declare function incrementSessionIteration(taskId: string, scheduler: SchedulerService): Effect.Effect<SessionState | null, SessionError, never>;
/**
 * Mark session as completed with promise tag
 */
/**
 * Mark session as completed with promise tag
 */
export declare function completeSessionWithPromise(taskId: string, promiseText: string, scheduler: SchedulerService): Effect.Effect<void, SessionError, never>;
/**
 * Check if session should continue (hasn't exceeded max iterations)
 */
/**
 * Check if session should continue (hasn't exceeded max iterations)
 */
export declare function shouldContinueSession(state: SessionState): boolean;
/**
 * Check if session is completed (has promise tag)
 */
/**
 * Check if session is completed (has promise tag)
 */
export declare function isSessionCompleted(state: SessionState): boolean;
/**
 * Save session state to checkpoint
 */
/**
 * Save session state using ironalarm checkpoints
 */
/**
 * Save session state using ironalarm checkpoints
 */
export declare function saveSessionState(taskId: string, state: SessionState, scheduler: SchedulerService): Effect.Effect<void, SessionError, never>;
/**
 * Load session state from checkpoint
 */
/**
 * Load session state from ironalarm checkpoints
 */
/**
 * Load session state from ironalarm checkpoints
 */
export declare function loadSessionState(taskId: string, scheduler: SchedulerService): Effect.Effect<SessionState | null, SessionError, never>;
