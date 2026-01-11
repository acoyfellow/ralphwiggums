/**
 * Browser Pool Management for Orchestrator
 *
 * Effect-based pool that manages container availability and health.
 * Delegates actual browser lifecycle to containers via /do endpoint.
 */
import { Effect } from "effect";
import type { BrowserInstance, BrowserPool } from "./types.js";
declare const PoolError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "PoolError";
} & Readonly<A>;
export declare class PoolError extends PoolError_base<{
    reason: string;
    containerUrl?: string;
}> {
}
declare const PoolExhaustedError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "PoolExhaustedError";
} & Readonly<A>;
export declare class PoolExhaustedError extends PoolExhaustedError_base<{
    requested: number;
    available: number;
}> {
}
/**
 * Create a new browser pool with containers
 */
export declare function createPool(containerUrls: string[], maxSize?: number): Effect.Effect<BrowserPool, never, never>;
/**
 * Perform concurrent health checks on all pool instances
 */
export declare function healthCheckPool(pool: BrowserPool): Effect.Effect<void, PoolError, never>;
/**
 * Find an available browser instance
 */
export declare function findAvailableBrowser(pool: BrowserPool): Effect.Effect<BrowserInstance, PoolExhaustedError, never>;
/**
 * Mark browser as busy
 */
export declare function markBrowserBusy(pool: BrowserPool, browserId: string, taskId: string): Effect.Effect<void, PoolError, never>;
/**
 * Mark browser as available
 */
export declare function markBrowserAvailable(pool: BrowserPool, browserId: string): Effect.Effect<void, PoolError, never>;
/**
 * Get pool status
 */
export declare function getPoolStatus(pool: BrowserPool): {
    size: number;
    maxSize: number;
    available: number;
    busy: number;
    unhealthy: number;
};
export {};
