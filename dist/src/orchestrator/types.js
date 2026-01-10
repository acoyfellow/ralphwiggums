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
        // ironalarm APIs return Effect, so just delegate
        return this.scheduler.schedule(at, taskId, taskName, params, options);
    }
    runNow(taskId, taskName, params, options) {
        // ironalarm APIs return Effect, so just delegate
        return this.scheduler.runNow(taskId, taskName, params, options);
    }
    checkpoint(taskId, key, value) {
        // ironalarm APIs return Effect, so just delegate
        return this.scheduler.checkpoint(taskId, key, value);
    }
    getCheckpoint(taskId, key) {
        // ironalarm APIs return Effect, so just delegate
        return this.scheduler.getCheckpoint(taskId, key);
    }
    getTask(taskId) {
        // ironalarm APIs return Effect, so just delegate
        return this.scheduler.getTask(taskId);
    }
    getTasks(status) {
        // ironalarm APIs return Effect, so just delegate
        return this.scheduler.getTasks(status);
    }
    cancelTask(taskId) {
        // ironalarm APIs return Effect, so just delegate
        return this.scheduler.cancelTask(taskId);
    }
    alarm() {
        // ironalarm APIs return Effect, so just delegate
        return this.scheduler.alarm();
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