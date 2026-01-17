/**
 * Session State Management for Orchestrator
 *
 * Manages task execution state, iterations, and checkpoints for resumable browser automation.
 * Uses ironalarm SchedulerService for persistence.
 */

import { Effect } from "effect";
import type { SessionState, SchedulerService } from "./types.js";
import { SessionError, OrchestratorError, SchedulerServiceTag, DEFAULT_PAUSE_TIMEOUT } from "./types.js";

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
 * Mark session as completed with promise tag detection
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

    // Save completed session state
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
    // Use SchedulerService checkpoint method (returns Effect)
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
    // Use SchedulerService getCheckpoint method (returns Effect<unknown>)
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

/**
 * Pause a session and save pause state
 */
export function pauseSession(
  taskId: string,
  pauseReason: string,
  scheduler: SchedulerService,
  timeout: number = DEFAULT_PAUSE_TIMEOUT
): Effect.Effect<{ resumeToken: string }, SessionError, never> {
  return Effect.gen(function* () {
    const currentState = yield* loadSessionState(taskId, scheduler);

    if (!currentState) {
      return yield* Effect.fail(new SessionError({
        reason: "Cannot pause: session state not found",
        taskId
      }));
    }

    // Generate unique resume token
    const resumeToken = crypto.randomUUID();

    const pausedState: SessionState = {
      ...currentState,
      paused: true,
      pauseReason,
      pauseRequestedAt: Date.now(),
      pauseResumeToken: resumeToken,
      pauseTimeout: timeout,
      lastUpdated: Date.now(),
    };

    yield* saveSessionState(taskId, pausedState, scheduler);

    return { resumeToken };
  });
}

/**
 * Resume a paused session
 */
export function resumeSession(
  taskId: string,
  resumeToken: string,
  scheduler: SchedulerService
): Effect.Effect<void, SessionError | OrchestratorError, never> {
  return Effect.gen(function* () {
    const currentState = yield* loadSessionState(taskId, scheduler);

    if (!currentState) {
      return yield* Effect.fail(new SessionError({
        reason: "Cannot resume: session state not found",
        taskId
      }));
    }

    if (!currentState.paused) {
      return yield* Effect.fail(new SessionError({
        reason: "Cannot resume: session is not paused",
        taskId
      }));
    }

    // Validate resume token
    if (currentState.pauseResumeToken !== resumeToken) {
      return yield* Effect.fail(new SessionError({
        reason: "Invalid resume token",
        taskId
      }));
    }

    // Check timeout
    if (currentState.pauseRequestedAt && currentState.pauseTimeout) {
      const elapsed = Date.now() - currentState.pauseRequestedAt;
      if (elapsed > currentState.pauseTimeout) {
        return yield* Effect.fail(new SessionError({
          reason: "Pause timeout expired",
          taskId
        }));
      }
    }

    // Clear pause state
    const resumedState: SessionState = {
      ...currentState,
      paused: false,
      pauseReason: undefined,
      pauseRequestedAt: undefined,
      pauseResumeToken: undefined,
      pauseTimeout: undefined,
      lastUpdated: Date.now(),
    };

    yield* saveSessionState(taskId, resumedState, scheduler);

    // Re-queue task for execution
    yield* scheduler.runNow(taskId, "browser-automation", {
      prompt: resumedState.prompt,
      maxIterations: resumedState.maxIterations,
      resumeFrom: taskId,
    });
  });
}

/**
 * Check if session is paused
 */
export function isSessionPaused(state: SessionState): boolean {
  return !!state.paused;
}

/**
 * Check if a paused session has expired (timeout exceeded)
 */
export function isPauseExpired(state: SessionState): boolean {
  if (!state.paused || !state.pauseRequestedAt || !state.pauseTimeout) {
    return false;
  }
  const elapsed = Date.now() - state.pauseRequestedAt;
  return elapsed > state.pauseTimeout;
}

/**
 * Cancel expired paused tasks
 * Returns list of cancelled task IDs
 */
export function cancelExpiredPausedTasks(
  tasks: Array<{ taskId: string }>,
  scheduler: SchedulerService
): Effect.Effect<string[], SessionError | OrchestratorError, never> {
  return Effect.gen(function* () {
    const cancelledTaskIds: string[] = [];

    for (const task of tasks) {
      const sessionState = yield* loadSessionState(task.taskId, scheduler);
      if (sessionState && isSessionPaused(sessionState) && isPauseExpired(sessionState)) {
        // Cancel the expired paused task
        yield* scheduler.cancelTask(task.taskId);
        cancelledTaskIds.push(task.taskId);
      }
    }

    return cancelledTaskIds;
  });
}