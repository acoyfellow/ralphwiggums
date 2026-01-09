/**
 * ralphwiggums - Orchestrator Types
 *
 * Effect-first browser automation orchestrator with ironalarm integration.
 */
import { Effect, Context } from "effect";
import type { ReliableScheduler, Task, TaskHandler } from "ironalarm";
import type { DurableObjectStorage } from "@cloudflare/workers-types";
declare const OrchestratorError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "OrchestratorError";
} & Readonly<A>;
export declare class OrchestratorError extends OrchestratorError_base<{
    reason: string;
    taskId?: string;
}> {
}
declare const BrowserAutomationError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "BrowserAutomationError";
} & Readonly<A>;
export declare class BrowserAutomationError extends BrowserAutomationError_base<{
    taskId: string;
    reason: string;
    stage: "navigation" | "action" | "extraction" | "checkpoint";
}> {
}
declare const PoolError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "PoolError";
} & Readonly<A>;
export declare class PoolError extends PoolError_base<{
    reason: string;
    browserId?: string;
}> {
}
declare const DispatcherError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "DispatcherError";
} & Readonly<A>;
export declare class DispatcherError extends DispatcherError_base<{
    reason: string;
    taskId?: string;
}> {
}
export interface BrowserAutomationParams {
    prompt: string;
    maxIterations?: number;
    timeout?: number;
    resumeFrom?: string;
}
export interface BrowserAutomationResult {
    success: boolean;
    message: string;
    data?: unknown;
    iterations: number;
    checkpointId?: string;
}
export type TaskParams = BrowserAutomationParams;
export interface OrchestratorDOState {
    storage: DurableObjectStorage;
}
export interface BrowserInstance {
    id: string;
    status: "available" | "busy" | "unhealthy";
    lastHealthCheck: number;
    currentTaskId?: string;
    url?: string;
}
export interface BrowserPool {
    instances: BrowserInstance[];
    maxSize: number;
    availableCount: number;
    busyCount: number;
    unhealthyCount: number;
}
export interface SessionState {
    taskId: string;
    iteration: number;
    prompt: string;
    completionPromise: string;
    maxIterations: number;
    checkpointId?: string;
    completed: boolean;
    url?: string;
}
export type BrowserAutomationHandler = (taskId: string, params: BrowserAutomationParams) => Effect.Effect<void, BrowserAutomationError, never>;
/**
 * Effect context for accessing scheduler operations.
 * All ironalarm methods return Promise, so we wrap with Effect.
 */
export declare class SchedulerService {
    readonly scheduler: ReliableScheduler;
    constructor(scheduler: ReliableScheduler);
    schedule(at: Date | number, taskId: string, taskName: string, params?: unknown, options?: {
        priority?: number;
    }): Effect.Effect<void, OrchestratorError>;
    runNow(taskId: string, taskName: string, params?: unknown, options?: {
        maxRetries?: number;
        priority?: number;
    }): Effect.Effect<void, OrchestratorError>;
    checkpoint(taskId: string, key: string, value: unknown): Effect.Effect<void, OrchestratorError>;
    getCheckpoint(taskId: string, key: string): Effect.Effect<unknown, OrchestratorError>;
    getTask(taskId: string): Effect.Effect<Task | undefined, OrchestratorError>;
    getTasks(status?: Task["status"]): Effect.Effect<Task[], OrchestratorError>;
    cancelTask(taskId: string): Effect.Effect<boolean, OrchestratorError>;
    alarm(): Effect.Effect<void, OrchestratorError>;
    register(taskName: string, handler: TaskHandler): void;
}
/** Effect service tag for SchedulerService */
export declare const SchedulerServiceTag: Context.Tag<SchedulerService, SchedulerService>;
export declare function detectPromiseTag(response: string): string | null;
export declare const DEFAULT_COMPLETION_PROMISE = "TASK_COMPLETE";
export {};
