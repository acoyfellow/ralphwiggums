/**
 * ralphwiggums - Core
 * Effect-first browser automation with OpenCode Zen.
 * Production-ready with secure-by-default configuration.
 */
import { Effect } from "effect";
export interface RalphOptions {
    maxIterations?: number;
    timeout?: number;
    resumeFrom?: string;
}
export interface RalphResult {
    success: boolean;
    message: string;
    data?: unknown;
    iterations: number;
    checkpointId?: string;
    requestId?: string;
}
export interface RalphConfig {
    apiKey: string;
    maxPromptLength: number;
    maxConcurrent: number;
    requestTimeout: number;
    debug: boolean;
}
declare const ValidationError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "ValidationError";
} & Readonly<A>;
export declare class ValidationError extends ValidationError_base<{
    field: string;
    reason: string;
}> {
}
declare const MaxIterationsError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "MaxIterationsError";
} & Readonly<A>;
export declare class MaxIterationsError extends MaxIterationsError_base<{
    maxIterations: number;
    requestId: string;
}> {
}
declare const TimeoutError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "TimeoutError";
} & Readonly<A>;
export declare class TimeoutError extends TimeoutError_base<{
    duration: number;
    requestId: string;
}> {
}
declare const BrowserError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "BrowserError";
} & Readonly<A>;
export declare class BrowserError extends BrowserError_base<{
    reason: string;
    requestId: string;
}> {
}
declare const RateLimitError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "RateLimitError";
} & Readonly<A>;
export declare class RateLimitError extends RateLimitError_base<{
    retryAfter: number;
}> {
}
declare const UnauthorizedError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "UnauthorizedError";
} & Readonly<A>;
export declare class UnauthorizedError extends UnauthorizedError_base {
}
declare const InternalError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "InternalError";
} & Readonly<A>;
declare class InternalError extends InternalError_base {
    readonly requestId: string;
    readonly message: string;
    constructor(requestId: string, message: string);
}
export declare function getConfig(): RalphConfig;
export declare function generateRequestId(): string;
export declare function log(requestId: string, level: string, message: string, meta?: Record<string, unknown>): void;
interface CircuitState {
    state: "closed" | "open" | "half-open";
    lastFailure: number;
    failureCount: number;
}
export declare function getCircuitState(): CircuitState;
export interface CheckpointData {
    checkpointId: string;
    taskId: string;
    iteration: number;
    url?: string;
    pageState?: string;
    timestamp: number;
    expiresAt: number;
}
export interface CheckpointStore {
    save(data: CheckpointData): Promise<void>;
    load(checkpointId: string): Promise<CheckpointData | null>;
    delete(checkpointId: string): Promise<void>;
    list(taskId: string): Promise<CheckpointData[]>;
    gc(): Promise<void>;
}
export { CheckpointDO, createInMemoryCheckpointStore, type CheckpointDOState, } from "./checkpoint-do.js";
interface LocalDurableObjectStorage {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    list<T>(options?: {
        start?: string;
        end?: string;
        limit?: number;
    }): Promise<Map<string, T>>;
}
export declare function getCheckpointStore(): CheckpointStore;
/**
 * Create a checkpoint store backed by Durable Objects.
 * Use this for production deployments with multiple workers.
 *
 * @param state - DO state with storage
 * @returns CheckpointStore implementation using DO storage
 */
export declare function createDOCheckpointStore(state: {
    storage: LocalDurableObjectStorage;
}): CheckpointStore;
export declare function saveCheckpoint(requestId: string, taskId: string, iteration: number, url?: string, pageState?: string): Promise<string>;
export declare function loadCheckpoint(checkpointId: string): Promise<CheckpointData | null>;
export declare function acquireSemaphore(): Promise<void>;
export declare function releaseSemaphore(): void;
export declare function getActiveRequestCount(): number;
export declare function setContainerBinding(binding: any): void;
export declare function setContainerFetch(fetchFn: ((path: string, body?: object) => Promise<any>) | null): void;
export declare function setContainerUrl(url: string): void;
export declare function doThis(prompt: string, opts?: RalphOptions, requestId?: string): Effect.Effect<RalphResult, ValidationError | MaxIterationsError | TimeoutError | BrowserError | RateLimitError | InternalError, never>;
export declare function run(prompt: string, opts?: RalphOptions, requestId?: string): Promise<RalphResult>;
import { Hono } from "hono";
export declare function createHandlers(): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
