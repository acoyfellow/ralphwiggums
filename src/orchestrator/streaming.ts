/**
 * Orchestrator Streaming Module
 *
 * Real-time task event streaming using Effect.Stream.
 * Provides SSE (Server-Sent Events) for task progress updates.
 */

import { Effect, Stream, Data } from "effect";

// ============================================================================
// Types
// ============================================================================

export type TaskEventType = "queued" | "running" | "completed" | "failed" | "checkpoint";

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  timestamp: number;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Errors
// ============================================================================

export class StreamingError extends Data.TaggedError("StreamingError")<{
  reason: string;
  taskId?: string;
}> {}

export class ListenerLimitError extends Data.TaggedError("ListenerLimitError")<{
  taskId: string;
  current: number;
  max: number;
}> {}

// ============================================================================
// SSE Helpers
// ============================================================================

export function formatSseEvent(event: TaskEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.type}\ndata: ${data}\n\n`;
}

export function createSseEvent(type: TaskEventType, taskId: string, data?: unknown, error?: string): TaskEvent {
  return {
    type,
    taskId,
    timestamp: Date.now(),
    data,
    error,
  };
}

// ============================================================================
// Stream Factory
// ============================================================================

export function createTaskEventStream(
  taskId: string,
  onComplete: () => void
): Stream.Stream<TaskEvent, StreamingError> {
  return Stream.async((emit) => {
    let closed = false;

    const sendEvent = (event: TaskEvent) => {
      if (!closed) {
        emit.single(event);
      }
    };

    sendEvent(createSseEvent("queued", taskId));

    return Effect.sync(() => {
      closed = true;
      onComplete();
    });
  });
}

export function createHeartbeatStream(taskId: string, intervalMs: number = 5000): Stream.Stream<TaskEvent, never> {
  return Stream.repeatEffect(
    Effect.sleep(intervalMs).pipe(
      Effect.as(createSseEvent("heartbeat" as TaskEventType, taskId))
    )
  );
}

export function mergeWithHeartbeat(
  stream: Stream.Stream<TaskEvent, StreamingError>,
  taskId: string,
  intervalMs: number = 5000
): Stream.Stream<TaskEvent, StreamingError> {
  const heartbeat = createHeartbeatStream(taskId, intervalMs);
  return Stream.merge(stream, heartbeat);
}

// ============================================================================
// Streaming Service (simplified)
// ============================================================================

interface ListenerCount {
  count: number;
}

class StreamingServiceImpl {
  private listeners = new Map<string, ListenerCount>();
  private readonly maxListeners: number;
  private readonly heartbeatInterval: number;

  constructor(options?: { maxListeners?: number; heartbeatInterval?: number }) {
    this.maxListeners = options?.maxListeners ?? 10;
    this.heartbeatInterval = options?.heartbeatInterval ?? 5000;
  }

  canAddListener(taskId: string): boolean {
    const current = this.listeners.get(taskId)?.count ?? 0;
    return current < this.maxListeners;
  }

  addListener(taskId: string): void {
    const current = this.listeners.get(taskId)?.count ?? 0;
    this.listeners.set(taskId, { count: current + 1 });
  }

  removeListener(taskId: string): void {
    const current = this.listeners.get(taskId)?.count ?? 0;
    if (current <= 1) {
      this.listeners.delete(taskId);
    } else {
      this.listeners.set(taskId, { count: current - 1 });
    }
  }

  getListenerCount(taskId: string): number {
    return this.listeners.get(taskId)?.count ?? 0;
  }
}

export const streamingService = new StreamingServiceImpl();

export type StreamingService = StreamingServiceImpl;
