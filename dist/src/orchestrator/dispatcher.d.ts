/**
 * Task Dispatcher for Orchestrator
 *
 * Routes tasks from ironalarm queue to available browser containers.
 * Uses Effect-based concurrency for parallel task execution.
 */
import { Effect } from "effect";
import type { ReliableScheduler } from "ironalarm";
import type { BrowserPool } from "./types.js";
import { PoolError, PoolExhaustedError } from "./pool.js";
declare const DispatcherError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "DispatcherError";
} & Readonly<A>;
export declare class DispatcherError extends DispatcherError_base<{
    reason: string;
    taskId?: string;
}> {
}
/**
 * Dispatch tasks from the queue to available browsers
 */
export declare function dispatchTasks(scheduler: ReliableScheduler, pool: BrowserPool): Effect.Effect<void, DispatcherError | PoolError | PoolExhaustedError, never>;
export {};
