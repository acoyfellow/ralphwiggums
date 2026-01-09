/**
 * ralphwiggums - Durable Object Checkpoint Storage
 * Production-ready checkpoint persistence using Cloudflare Durable Objects.
 */
import { Effect } from "effect";
import type { DurableObjectState } from "@cloudflare/workers-types";
declare const CheckpointError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "CheckpointError";
} & Readonly<A>;
export declare class CheckpointError extends CheckpointError_base<{
    checkpointId: string;
    reason: string;
}> {
}
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
/**
 * Creates an in-memory checkpoint store (for development/testing).
 */
export declare function createInMemoryCheckpointStore(): CheckpointStore;
export interface CheckpointDOState {
    storage: DurableObjectStorage;
}
export interface DurableObjectStorage {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    list<T>(options?: {
        start?: string;
        end?: string;
        limit?: number;
    }): Promise<Map<string, T>>;
}
/**
 * Checkpoint Durable Object utility class for Cloudflare Workers.
 *
 * Usage in worker:
 * ```typescript
 * import { CheckpointDO } from "ralphwiggums/checkpoint-do";
 *
 * export class RalphAgent extends DurableObject {
 *   async fetch(request) {
 *     return CheckpointDO.fetch(this.state, this.env, request);
 *   }
 * }
 * ```
 */
export declare class CheckpointDO {
    static fetch(state: DurableObjectState, env: Record<string, unknown>, request: Request): Promise<Response>;
    private static save;
    private static load;
    private static delete;
    private static list;
    private static gc;
}
/**
 * Save a checkpoint using Effect.
 */
export declare function saveCheckpointEffect(checkpointId: string, taskId: string, iteration: number, url?: string, pageState?: string): Effect.Effect<void, CheckpointError, never>;
/**
 * Load a checkpoint using Effect.
 */
export declare function loadCheckpointEffect(checkpointId: string): Effect.Effect<CheckpointData | null, CheckpointError, never>;
/**
 * List checkpoints for a task using Effect.
 */
export declare function listCheckpointsEffect(taskId: string): Effect.Effect<CheckpointData[], CheckpointError, never>;
export {};
