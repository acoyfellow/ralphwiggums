/**
 * ralphwiggums - Durable Object Checkpoint Storage
 * Production-ready checkpoint persistence using Cloudflare Durable Objects.
 */

import { Effect, Data, Layer } from "effect";
import type { DurableObject } from "@cloudflare/workers-types";

// ============================================================================
// Errors
// ============================================================================

export class CheckpointError extends Data.TaggedError("CheckpointError")<{
  checkpointId: string;
  reason: string;
}> {}

// ============================================================================
// Types (mirrors index.ts)
// ============================================================================

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

// ============================================================================
// In-Memory Store (fallback for single-instance or testing)
// ============================================================================

const IN_MEMORY_TTL = 3600000; // 1 hour

/**
 * Creates an in-memory checkpoint store (for development/testing).
 */
export function createInMemoryCheckpointStore(): CheckpointStore {
  const store: Map<string, CheckpointData> = new Map();
  const taskIndex: Map<string, string[]> = new Map();

  return {
    async save(data: CheckpointData): Promise<void> {
      store.set(data.checkpointId, data);

      const checkpoints = taskIndex.get(data.taskId) || [];
      if (!checkpoints.includes(data.checkpointId)) {
        checkpoints.push(data.checkpointId);
        taskIndex.set(data.taskId, checkpoints);
      }
    },

    async load(checkpointId: string): Promise<CheckpointData | null> {
      return store.get(checkpointId) || null;
    },

    async delete(checkpointId: string): Promise<void> {
      const data = store.get(checkpointId);
      if (data) {
        store.delete(checkpointId);
        const checkpoints = taskIndex.get(data.taskId);
        if (checkpoints) {
          const idx = checkpoints.indexOf(checkpointId);
          if (idx >= 0) checkpoints.splice(idx, 1);
        }
      }
    },

    async list(taskId: string): Promise<CheckpointData[]> {
      const checkpointIds = taskIndex.get(taskId) || [];
      return checkpointIds
        .map((id) => store.get(id))
        .filter((c): c is CheckpointData => c !== undefined);
    },

    async gc(): Promise<void> {
      const now = Date.now();
      for (const [id, data] of store.entries()) {
        if (now > data.expiresAt) {
          store.delete(id);
          const checkpoints = taskIndex.get(data.taskId);
          if (checkpoints) {
            const idx = checkpoints.indexOf(id);
            if (idx >= 0) checkpoints.splice(idx, 1);
          }
        }
      }
    },
  };
}

// ============================================================================
// Durable Object Store
// ============================================================================

export interface CheckpointDOState {
  storage: DurableObjectStorage;
}

export interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list<T>(options?: { start?: string; end?: string; limit?: number }): Promise<Map<string, T>>;
}

/**
 * Checkpoint Durable Object class for Cloudflare Workers.
 *
 * Usage in wrangler.toml:
 * ```toml
 * [[durable_objects.bindings]]
 * name = "CHECKPOINT_DO"
 * class_name = "CheckpointDO"
 *
 * [durable_objects.classes]
 * CheckpointDO = { row_key = "checkpoints", column_key = "task_index" }
 * ```
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
export class CheckpointDO implements DurableObject {
  constructor(
    readonly state: DurableObjectState,
    readonly env: Record<string, unknown>
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    try {
      switch (request.method) {
        case "GET": {
          if (path.startsWith("list/")) {
            const taskId = path.slice(5);
            const checkpoints = await this.list(taskId);
            return new Response(JSON.stringify(checkpoints), {
              headers: { "Content-Type": "application/json" },
            });
          }
          const checkpoint = await this.load(path);
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
            await this.save(data as CheckpointData);
            return new Response(JSON.stringify({ success: true }), {
              headers: { "Content-Type": "application/json" },
            });
          }
          if (path === "gc") {
            await this.gc();
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
          await this.delete(path);
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
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // ========================================================================
  // DO Storage Operations
  // ========================================================================

  private async save(data: CheckpointData): Promise<void> {
    await this.state.storage.put(`checkpoint:${data.checkpointId}`, data);

    const taskIndexRaw = await this.state.storage.get<string[]>(`task_index:${data.taskId}`);
    const taskIndex = taskIndexRaw || [];
    if (!taskIndex.includes(data.checkpointId)) {
      taskIndex.push(data.checkpointId);
      await this.state.storage.put(`task_index:${data.taskId}`, taskIndex);
    }
  }

  private async load(checkpointId: string): Promise<CheckpointData | null> {
    const data = await this.state.storage.get<CheckpointData>(`checkpoint:${checkpointId}`);
    if (!data) return null;

    if (Date.now() > data.expiresAt) {
      await this.delete(checkpointId);
      return null;
    }

    return data;
  }

  private async delete(checkpointId: string): Promise<void> {
    const data = await this.state.storage.get<CheckpointData>(`checkpoint:${checkpointId}`);
    if (!data) return;

    await this.state.storage.delete(`checkpoint:${checkpointId}`);

    const taskIndexRaw = await this.state.storage.get<string[]>(`task_index:${data.taskId}`);
    if (taskIndexRaw) {
      const idx = taskIndexRaw.indexOf(checkpointId);
      if (idx >= 0) {
        taskIndexRaw.splice(idx, 1);
        if (taskIndexRaw.length === 0) {
          await this.state.storage.delete(`task_index:${data.taskId}`);
        } else {
          await this.state.storage.put(`task_index:${data.taskId}`, taskIndexRaw);
        }
      }
    }
  }

  private async list(taskId: string): Promise<CheckpointData[]> {
    const taskIndexRaw = await this.state.storage.get<string[]>(`task_index:${taskId}`);
    if (!taskIndexRaw) return [];

    const checkpoints: CheckpointData[] = [];
    const now = Date.now();

    for (const checkpointId of taskIndexRaw) {
      const data = await this.state.storage.get<CheckpointData>(`checkpoint:${checkpointId}`);
      if (data && now <= data.expiresAt) {
        checkpoints.push(data);
      }
    }

    return checkpoints;
  }

  private async gc(): Promise<void> {
    const now = Date.now();

    const taskIndexEntries = await this.state.storage.list<unknown>({
      start: "task_index:",
      end: "task_index:\xff",
    });

    for (const [key, value] of taskIndexEntries) {
      const taskIndex = value as string[];
      const validCheckpoints: string[] = [];

      for (const checkpointId of taskIndex) {
        const data = await this.state.storage.get<CheckpointData>(`checkpoint:${checkpointId}`);
        if (data && now <= data.expiresAt) {
          validCheckpoints.push(checkpointId);
        } else {
          await this.state.storage.delete(`checkpoint:${checkpointId}`);
        }
      }

      if (validCheckpoints.length === 0) {
        await this.state.storage.delete(key);
      } else {
        await this.state.storage.put(key, validCheckpoints);
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
export function saveCheckpointEffect(
  checkpointId: string,
  taskId: string,
  iteration: number,
  url?: string,
  pageState?: string
): Effect.Effect<void, CheckpointError, never> {
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
    catch: (e) =>
      new CheckpointError({
        checkpointId,
        reason: e instanceof Error ? e.message : "save failed",
      }),
  });
}

/**
 * Load a checkpoint using Effect.
 */
export function loadCheckpointEffect(
  checkpointId: string
): Effect.Effect<CheckpointData | null, CheckpointError, never> {
  return Effect.tryPromise({
    try: async () => {
      const store = createInMemoryCheckpointStore();
      return store.load(checkpointId);
    },
    catch: (e) =>
      new CheckpointError({
        checkpointId,
        reason: e instanceof Error ? e.message : "load failed",
      }),
  });
}

/**
 * List checkpoints for a task using Effect.
 */
export function listCheckpointsEffect(
  taskId: string
): Effect.Effect<CheckpointData[], CheckpointError, never> {
  return Effect.tryPromise({
    try: async () => {
      const store = createInMemoryCheckpointStore();
      return store.list(taskId);
    },
    catch: (e) =>
      new CheckpointError({
        checkpointId: taskId,
        reason: e instanceof Error ? e.message : "list failed",
      }),
  });
}
