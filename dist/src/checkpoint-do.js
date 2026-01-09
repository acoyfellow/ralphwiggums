/**
 * ralphwiggums - Durable Object Checkpoint Storage
 * Production-ready checkpoint persistence using Cloudflare Durable Objects.
 */
import { Effect, Data, Layer } from "effect";
// ============================================================================
// Errors
// ============================================================================
export class CheckpointError extends Data.TaggedError("CheckpointError") {
}
// ============================================================================
// In-Memory Store (fallback for single-instance or testing)
// ============================================================================
const IN_MEMORY_TTL = 3600000; // 1 hour
/**
 * Creates an in-memory checkpoint store (for development/testing).
 */
export function createInMemoryCheckpointStore() {
    const store = new Map();
    const taskIndex = new Map();
    return {
        async save(data) {
            store.set(data.checkpointId, data);
            const checkpoints = taskIndex.get(data.taskId) || [];
            if (!checkpoints.includes(data.checkpointId)) {
                checkpoints.push(data.checkpointId);
                taskIndex.set(data.taskId, checkpoints);
            }
        },
        async load(checkpointId) {
            return store.get(checkpointId) || null;
        },
        async delete(checkpointId) {
            const data = store.get(checkpointId);
            if (data) {
                store.delete(checkpointId);
                const checkpoints = taskIndex.get(data.taskId);
                if (checkpoints) {
                    const idx = checkpoints.indexOf(checkpointId);
                    if (idx >= 0)
                        checkpoints.splice(idx, 1);
                }
            }
        },
        async list(taskId) {
            const checkpointIds = taskIndex.get(taskId) || [];
            return checkpointIds
                .map((id) => store.get(id))
                .filter((c) => c !== undefined);
        },
        async gc() {
            const now = Date.now();
            for (const [id, data] of store.entries()) {
                if (now > data.expiresAt) {
                    store.delete(id);
                    const checkpoints = taskIndex.get(data.taskId);
                    if (checkpoints) {
                        const idx = checkpoints.indexOf(id);
                        if (idx >= 0)
                            checkpoints.splice(idx, 1);
                    }
                }
            }
        },
    };
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
export class CheckpointDO {
    static async fetch(state, env, request) {
        const url = new URL(request.url);
        const path = url.pathname.slice(1);
        try {
            switch (request.method) {
                case "GET": {
                    if (path.startsWith("list/")) {
                        const taskId = path.slice(5);
                        const checkpoints = await CheckpointDO.list(state, taskId);
                        return new Response(JSON.stringify(checkpoints), {
                            headers: { "Content-Type": "application/json" },
                        });
                    }
                    const checkpoint = await CheckpointDO.load(state, path);
                    if (!checkpoint) {
                        return new Response(JSON.stringify({ error: "not found" }), {
                            status: 404,
                            headers: { "Content-Type": "application/json" },
                        });
                    }
                    return new Response(JSON.stringify(checkpoint), {
                        headers: { "Content-Type": "application/json" },
                    });
                }
                case "POST": {
                    if (path === "save") {
                        const data = await request.json();
                        await CheckpointDO.save(state, data);
                        return new Response(JSON.stringify({ success: true }), {
                            headers: { "Content-Type": "application/json" },
                        });
                    }
                    if (path === "gc") {
                        await CheckpointDO.gc(state);
                        return new Response(JSON.stringify({ success: true }), {
                            headers: { "Content-Type": "application/json" },
                        });
                    }
                    return new Response(JSON.stringify({ error: "unknown endpoint" }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }
                case "DELETE": {
                    await CheckpointDO.delete(state, path);
                    return new Response(JSON.stringify({ success: true }), {
                        headers: { "Content-Type": "application/json" },
                    });
                }
                default:
                    return new Response(JSON.stringify({ error: "method not allowed" }), {
                        status: 405,
                        headers: { "Content-Type": "application/json" },
                    });
            }
        }
        catch (error) {
            return new Response(JSON.stringify({
                error: error instanceof Error ? error.message : "unknown error",
            }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }
    // ========================================================================
    // DO Storage Operations
    // ========================================================================
    static async save(state, data) {
        await state.storage.put(`checkpoint:${data.checkpointId}`, data);
        const taskIndexRaw = await state.storage.get(`task_index:${data.taskId}`);
        const taskIndex = taskIndexRaw || [];
        if (!taskIndex.includes(data.checkpointId)) {
            taskIndex.push(data.checkpointId);
            await state.storage.put(`task_index:${data.taskId}`, taskIndex);
        }
    }
    static async load(state, checkpointId) {
        const data = await state.storage.get(`checkpoint:${checkpointId}`);
        if (!data)
            return null;
        if (Date.now() > data.expiresAt) {
            await CheckpointDO.delete(state, checkpointId);
            return null;
        }
        return data;
    }
    static async delete(state, checkpointId) {
        const data = await state.storage.get(`checkpoint:${checkpointId}`);
        if (!data)
            return;
        await state.storage.delete(`checkpoint:${checkpointId}`);
        const taskIndexRaw = await state.storage.get(`task_index:${data.taskId}`);
        if (taskIndexRaw) {
            const idx = taskIndexRaw.indexOf(checkpointId);
            if (idx >= 0) {
                taskIndexRaw.splice(idx, 1);
                if (taskIndexRaw.length === 0) {
                    await state.storage.delete(`task_index:${data.taskId}`);
                }
                else {
                    await state.storage.put(`task_index:${data.taskId}`, taskIndexRaw);
                }
            }
        }
    }
    static async list(state, taskId) {
        const taskIndexRaw = await state.storage.get(`task_index:${taskId}`);
        if (!taskIndexRaw)
            return [];
        const checkpoints = [];
        const now = Date.now();
        for (const checkpointId of taskIndexRaw) {
            const data = await state.storage.get(`checkpoint:${checkpointId}`);
            if (data && now <= data.expiresAt) {
                checkpoints.push(data);
            }
        }
        return checkpoints;
    }
    static async gc(state) {
        const now = Date.now();
        const taskIndexEntries = await state.storage.list({
            start: "task_index:",
            end: "task_index:\xff",
        });
        for (const [key, value] of taskIndexEntries) {
            const taskIndex = value;
            const validCheckpoints = [];
            for (const checkpointId of taskIndex) {
                const data = await state.storage.get(`checkpoint:${checkpointId}`);
                if (data && now <= data.expiresAt) {
                    validCheckpoints.push(checkpointId);
                }
                else {
                    await state.storage.delete(`checkpoint:${checkpointId}`);
                }
            }
            if (validCheckpoints.length === 0) {
                await state.storage.delete(key);
            }
            else {
                await state.storage.put(key, validCheckpoints);
            }
        }
    }
}
// ============================================================================
// Effect-friendly API
// ============================================================================
/**
 * Save a checkpoint using Effect.
 */
export function saveCheckpointEffect(checkpointId, taskId, iteration, url, pageState) {
    return Effect.tryPromise({
        try: async () => {
            const store = createInMemoryCheckpointStore();
            await store.save({
                checkpointId,
                taskId,
                iteration,
                url,
                pageState,
                timestamp: Date.now(),
                expiresAt: Date.now() + IN_MEMORY_TTL,
            });
        },
        catch: (e) => new CheckpointError({
            checkpointId,
            reason: e instanceof Error ? e.message : "save failed",
        }),
    });
}
/**
 * Load a checkpoint using Effect.
 */
export function loadCheckpointEffect(checkpointId) {
    return Effect.tryPromise({
        try: async () => {
            const store = createInMemoryCheckpointStore();
            return store.load(checkpointId);
        },
        catch: (e) => new CheckpointError({
            checkpointId,
            reason: e instanceof Error ? e.message : "load failed",
        }),
    });
}
/**
 * List checkpoints for a task using Effect.
 */
export function listCheckpointsEffect(taskId) {
    return Effect.tryPromise({
        try: async () => {
            const store = createInMemoryCheckpointStore();
            return store.list(taskId);
        },
        catch: (e) => new CheckpointError({
            checkpointId: taskId,
            reason: e instanceof Error ? e.message : "list failed",
        }),
    });
}
//# sourceMappingURL=checkpoint-do.js.map