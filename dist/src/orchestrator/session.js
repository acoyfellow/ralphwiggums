/**
 * ralphwiggums - Session State Management
 *
 * Manages task execution state, iterations, and checkpoints for orchestrator.
 * Provides clear separation between container (single prompt execution) and
 * orchestrator (multi-iteration task lifecycle).
 */
import { Effect } from "effect";
import { SchedulerServiceTag } from "./types.js";
/**
 * Create initial session state for a task
 */
export function createSessionState(taskId, prompt, maxIterations) {
    return {
        taskId,
        iteration: 0,
        prompt,
        completionPromise: "TASK_COMPLETE", // Default promise text
        maxIterations,
        completed: false,
    };
}
/**
 * Update session state after an iteration
 */
export function updateSessionState(state, iteration, result, promiseCompleted) {
    return {
        ...state,
        iteration,
        completed: promiseCompleted,
    };
}
/**
 * Check if task should continue iterating
 */
export function shouldContinueIteration(state) {
    return !state.completed && state.iteration < state.maxIterations;
}
/**
 * Get next iteration number
 */
export function getNextIteration(state) {
    return state.iteration + 1;
}
/**
 * Save session state to checkpoint
 */
export function saveSessionState(taskId, state) {
    return Effect.gen(function* () {
        const svc = yield* SchedulerServiceTag;
        // Save key session state for resume capability
        yield* svc.checkpoint(taskId, "session_state", state);
        yield* svc.checkpoint(taskId, "iteration", state.iteration);
        yield* svc.checkpoint(taskId, "completed", state.completed);
    });
}
/**
 * Load session state from checkpoint
 */
export function loadSessionState(taskId) {
    return Effect.gen(function* () {
        const svc = yield* SchedulerServiceTag;
        const state = yield* svc.getCheckpoint(taskId, "session_state");
        if (state && typeof state === "object") {
            return state;
        }
        // Fallback: try to reconstruct from individual fields
        const iteration = yield* svc.getCheckpoint(taskId, "iteration");
        const completed = yield* svc.getCheckpoint(taskId, "completed");
        if (typeof iteration === "number" && typeof completed === "boolean") {
            return {
                taskId,
                iteration: iteration,
                prompt: "", // Would need to be stored separately
                completionPromise: "TASK_COMPLETE",
                maxIterations: 10, // Default
                completed: completed,
            };
        }
        return null;
    });
}
//# sourceMappingURL=session.js.map