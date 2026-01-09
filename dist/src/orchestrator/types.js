/**
 * ralphwiggums - Orchestrator Types
 *
 * Effect-first browser automation orchestrator with ironalarm integration.
 */
import { Effect, Data, Context } from "effect";
// ============================================================================
// Errors
// ============================================================================
export class OrchestratorError extends Data.TaggedError("OrchestratorError") {
}
export class BrowserAutomationError extends Data.TaggedError("BrowserAutomationError") {
}
export class PoolError extends Data.TaggedError("PoolError") {
}
export class DispatcherError extends Data.TaggedError("DispatcherError") {
}
// ============================================================================
// Scheduler Context (ironalarm integration)
// ============================================================================
/**
 * Effect context for accessing scheduler operations.
 * All ironalarm methods return Promise, so we wrap with Effect.
 */
export class SchedulerService {
    scheduler;
    constructor(scheduler) {
        this.scheduler = scheduler;
    }
    schedule(at, taskId, taskName, params, options) {
        return Effect.tryPromise({
            try: () => this.scheduler.schedule(at, taskId, taskName, params, options),
            catch: (e) => new OrchestratorError({
                reason: e instanceof Error ? e.message : "schedule failed",
            }),
        });
    }
    runNow(taskId, taskName, params, options) {
        return Effect.tryPromise({
            try: () => this.scheduler.runNow(taskId, taskName, params, options),
            catch: (e) => new OrchestratorError({
                reason: e instanceof Error ? e.message : "runNow failed",
            }),
        });
    }
    checkpoint(taskId, key, value) {
        return Effect.tryPromise({
            try: () => this.scheduler.checkpoint(taskId, key, value),
            catch: (e) => new OrchestratorError({
                reason: e instanceof Error ? e.message : "checkpoint failed",
            }),
        });
    }
    getCheckpoint(taskId, key) {
        return Effect.tryPromise({
            try: () => this.scheduler.getCheckpoint(taskId, key),
            catch: (e) => new OrchestratorError({
                reason: e instanceof Error ? e.message : "getCheckpoint failed",
            }),
        });
    }
    getTask(taskId) {
        return Effect.tryPromise({
            try: () => this.scheduler.getTask(taskId),
            catch: (e) => new OrchestratorError({
                reason: e instanceof Error ? e.message : "getTask failed",
            }),
        });
    }
    getTasks(status) {
        return Effect.tryPromise({
            try: () => this.scheduler.getTasks(status),
            catch: (e) => new OrchestratorError({
                reason: e instanceof Error ? e.message : "getTasks failed",
            }),
        });
    }
    cancelTask(taskId) {
        return Effect.tryPromise({
            try: () => this.scheduler.cancelTask(taskId),
            catch: (e) => new OrchestratorError({
                reason: e instanceof Error ? e.message : "cancelTask failed",
            }),
        });
    }
    alarm() {
        return Effect.tryPromise({
            try: () => this.scheduler.alarm(),
            catch: (e) => new OrchestratorError({
                reason: e instanceof Error ? e.message : "alarm failed",
            }),
        });
    }
    register(taskName, handler) {
        this.scheduler.register(taskName, handler);
    }
}
/** Effect service tag for SchedulerService */
export const SchedulerServiceTag = Context.GenericTag("@ralphwiggums/SchedulerService");
// ============================================================================
// Promise Tag Detection
// ============================================================================
const PROMISE_TAG_REGEX = /<promise>(.*?)<\/promise>/gi;
export function detectPromiseTag(response) {
    const match = PROMISE_TAG_REGEX.exec(response);
    if (match) {
        return match[1];
    }
    return null;
}
export const DEFAULT_COMPLETION_PROMISE = "TASK_COMPLETE";
//# sourceMappingURL=types.js.map