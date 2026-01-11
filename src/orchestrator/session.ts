/**
 * Session State Management for Orchestrator
 *
 * Manages task execution state, iterations, and checkpoints for resumable browser automation.
 * Uses ironalarm SchedulerService for persistence.
 */

import { Effect } from "effect";
import type { SessionState, SchedulerService } from "./types.js";
import { SessionError, SchedulerServiceTag } from "./types.js";

/**
 * Update session iteration count
 */
/**
 * Update session iteration count
 */
export function incrementSessionIteration(
  taskId: string,
  scheduler: SchedulerService
): Effect.Effect<SessionState | null, SessionError, never> {
  return Effect.gen(function* () {
    const currentState = yield* loadSessionState(taskId, scheduler);

    if (!currentState) {
      return null;
    }

    const updatedState: SessionState = {
      ...currentState,
      iteration: currentState.iteration + 1,
      lastUpdated: Date.now(),
    };

    yield* saveSessionState(taskId, updatedState, scheduler);
    return updatedState;
  });
}

/**
 * Mark session as completed with promise tag
 */
/**
 * Mark session as completed with promise tag
 */
export function completeSessionWithPromise(
  taskId: string,
  promiseText: string,
  scheduler: SchedulerService
): Effect.Effect<void, SessionError, never> {
  return Effect.gen(function* () {
    const currentState = yield* loadSessionState(taskId, scheduler);

    if (!currentState) {
      return;
    }

    const completedState: SessionState = {
      ...currentState,
      completionPromise: promiseText,
      completed: true,
      lastUpdated: Date.now(),
    };

    yield* saveSessionState(taskId, completedState, scheduler);
  });
}

/**
 * Check if session should continue (hasn't exceeded max iterations)
 */
/**
 * Check if session should continue (hasn't exceeded max iterations)
 */
export function shouldContinueSession(
  state: SessionState
): boolean {
  return !state.completed && state.iteration < state.maxIterations;
}

/**
 * Check if session is completed (has promise tag)
 */
/**
 * Check if session is completed (has promise tag)
 */
export function isSessionCompleted(
  state: SessionState
): boolean {
  return !!state.completionPromise && !!state.completed;
}

/**
 * Save session state to checkpoint
 */
/**
 * Save session state using ironalarm checkpoints
 */
/**
 * Save session state using ironalarm checkpoints
 */
export function saveSessionState(
  taskId: string,
  state: SessionState,
  scheduler: SchedulerService
): Effect.Effect<void, SessionError, never> {
  return Effect.gen(function* () {
    yield* scheduler.checkpoint(taskId, "session", state);
  }).pipe(
    Effect.mapError(() => new SessionError({
      reason: "Failed to save session state",
      taskId
    }))
  );
}

/**
 * Load session state from checkpoint
 */
/**
 * Load session state from ironalarm checkpoints
 */
/**
 * Load session state from ironalarm checkpoints
 */
export function loadSessionState(
  taskId: string,
  scheduler: SchedulerService
): Effect.Effect<SessionState | null, SessionError, never> {
  return Effect.gen(function* () {
    const state = yield* scheduler.getCheckpoint(taskId, "session");

    if (!state) {
      return null;
    }

    // Validate the loaded state structure
    if (typeof state === 'object' && state !== null &&
        'taskId' in state && 'iteration' in state && 'prompt' in state) {
      return state as SessionState;
    }

    return null;
  }).pipe(
    Effect.mapError(() => new SessionError({
      reason: "Failed to load session state",
      taskId
    }))
  );
}