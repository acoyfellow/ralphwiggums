/**
 * ralphwiggums - Core
 * Effect-first browser automation on Cloudflare Workers.
 * Production-ready with secure-by-default configuration.
 */

import { Effect, Data } from "effect";

// ============================================================================
// Configuration
// ============================================================================

// ============================================================================
// Simple validation without full Zod dependency
// ============================================================================

function validateString(value: unknown, maxLength: number, field: string): string {
  if (typeof value !== "string") {
    throw new ValidationError({ field, reason: `Expected string for ${field}` });
  }
  if (!value.trim()) {
    throw new ValidationError({ field, reason: `${field} is required` });
  }
  if (value.length > maxLength) {
    throw new ValidationError({ field, reason: `${field} exceeds maximum length of ${maxLength}` });
  }
  return value;
}

function validatePositiveInt(value: unknown, defaultValue: number, field: string): number {
  if (value === undefined || value === null) return defaultValue;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new ValidationError({ field, reason: `${field} must be a non-negative number` });
  }
  return num;
}

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Errors
// ============================================================================

export class ValidationError extends Data.TaggedError("ValidationError")<{
  field: string;
  reason: string;
}> {}

export class MaxIterationsError extends Data.TaggedError("MaxIterationsError")<{
  maxIterations: number;
  requestId: string;
}> {}

export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  duration: number;
  requestId: string;
}> {}

export class BrowserError extends Data.TaggedError("BrowserError")<{
  reason: string;
  requestId: string;
}> {}

export class RateLimitError extends Data.TaggedError("RateLimitError")<{
  retryAfter: number;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError") {}

class InternalError extends Data.TaggedError("InternalError") {
  constructor(
    public readonly requestId: string,
    public readonly message: string
  ) {
    super();
  }
}

// ============================================================================
// Configuration (secure by default)
// ============================================================================

function getEnv(key: string, defaultValue: string): string {
  return typeof process !== "undefined" && process.env?.[key]
    ? process.env[key]!
    : defaultValue;
}

export function getConfig(): RalphConfig {
  return {
    apiKey: getEnv("RALPH_API_KEY", ""),
    maxPromptLength: parseInt(getEnv("RALPH_MAX_PROMPT_LENGTH", "10000"), 10),
    maxConcurrent: parseInt(getEnv("RALPH_MAX_CONCURRENT", "5"), 10),
    requestTimeout: parseInt(getEnv("RALPH_REQUEST_TIMEOUT", "300000"), 10),
    debug: getEnv("RALPH_DEBUG", "false") === "true",
  };
}

// ============================================================================
// Request tracking & logging
// ============================================================================

let requestCounter = 0;

export function generateRequestId(): string {
  return `rw_${Date.now()}_${++requestCounter % 100000}`;
}

export function log(requestId: string, level: string, message: string, meta?: Record<string, unknown>) {
  const config = getConfig();
  if (!config.debug && level === "debug") return;
  
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    requestId,
    message,
  };
  if (meta) entry.meta = meta;
  
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ============================================================================
// Rate limiting (simple in-memory per-IP)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 60;

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    throw new RateLimitError({ retryAfter: Math.ceil((entry.resetAt - now) / 1000) });
  }
  
  entry.count++;
  
  // Cleanup expired entries on-demand
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}

// ============================================================================
// Circuit Breaker for container failures
// ============================================================================

interface CircuitState {
  state: "closed" | "open" | "half-open";
  lastFailure: number;
  failureCount: number;
}

const CIRCUIT_FAILURE_THRESHOLD = 5; // Failures before opening
const CIRCUIT_RESET_TIMEOUT = 30000; // 30 seconds before trying again

let circuitState: CircuitState = {
  state: "closed",
  lastFailure: 0,
  failureCount: 0,
};

export function getCircuitState(): CircuitState {
  return { ...circuitState };
}

function recordFailure() {
  circuitState.failureCount++;
  circuitState.lastFailure = Date.now();
  
  if (circuitState.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitState.state = "open";
    log("system", "warn", "Circuit breaker opened", { 
      failures: circuitState.failureCount 
    });
  }
}

function recordSuccess() {
  if (circuitState.state === "half-open") {
    circuitState.state = "closed";
    circuitState.failureCount = 0;
    log("system", "info", "Circuit breaker closed (recovery)");
  }
}

// ============================================================================
// Checkpoint Persistence
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

// Re-export DO checkpoint storage
export {
  CheckpointDO,
  createInMemoryCheckpointStore,
  type CheckpointDOState,
} from "./checkpoint-do.js";

// Durable Object storage interface for DO-based checkpoint store
interface LocalDurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list<T>(options?: { start?: string; end?: string; limit?: number }): Promise<Map<string, T>>;
}

// In-memory store for single-instance deployment
const checkpointStore: Map<string, CheckpointData> = new Map();
const TASK_CHECKPOINTS: Map<string, string[]> = new Map();
const CHECKPOINT_TTL = 3600000; // 1 hour

export function getCheckpointStore(): CheckpointStore {
  return {
    async save(data: CheckpointData): Promise<void> {
      checkpointStore.set(data.checkpointId, data);
      
      const taskCheckpoints = TASK_CHECKPOINTS.get(data.taskId) || [];
      if (!taskCheckpoints.includes(data.checkpointId)) {
        taskCheckpoints.push(data.checkpointId);
        TASK_CHECKPOINTS.set(data.taskId, taskCheckpoints);
      }
    },
    
    async load(checkpointId: string): Promise<CheckpointData | null> {
      return checkpointStore.get(checkpointId) || null;
    },
    
    async delete(checkpointId: string): Promise<void> {
      const data = checkpointStore.get(checkpointId);
      if (data) {
        checkpointStore.delete(checkpointId);
        const taskCheckpoints = TASK_CHECKPOINTS.get(data.taskId);
        if (taskCheckpoints) {
          const idx = taskCheckpoints.indexOf(checkpointId);
          if (idx >= 0) taskCheckpoints.splice(idx, 1);
        }
      }
    },
    
    async list(taskId: string): Promise<CheckpointData[]> {
      const checkpointIds = TASK_CHECKPOINTS.get(taskId) || [];
      return checkpointIds
        .map(id => checkpointStore.get(id))
        .filter((c): c is CheckpointData => c !== undefined);
    },
    
    async gc(): Promise<void> {
      const now = Date.now();
      for (const [id, data] of checkpointStore.entries()) {
        if (now > data.expiresAt) {
          checkpointStore.delete(id);
          const taskCheckpoints = TASK_CHECKPOINTS.get(data.taskId);
          if (taskCheckpoints) {
            const idx = taskCheckpoints.indexOf(id);
            if (idx >= 0) taskCheckpoints.splice(idx, 1);
          }
        }
      }
    },
  };
}

/**
 * Create a checkpoint store backed by Durable Objects.
 * Use this for production deployments with multiple workers.
 *
 * @param state - DO state with storage
 * @returns CheckpointStore implementation using DO storage
 */
export function createDOCheckpointStore(state: { storage: LocalDurableObjectStorage }): CheckpointStore {
  return {
    async save(data: CheckpointData): Promise<void> {
      await state.storage.put(`checkpoint:${data.checkpointId}`, data);

      const taskIndexRaw = await state.storage.get<string[]>(`task_index:${data.taskId}`);
      const taskIndex = taskIndexRaw || [];
      if (!taskIndex.includes(data.checkpointId)) {
        taskIndex.push(data.checkpointId);
        await state.storage.put(`task_index:${data.taskId}`, taskIndex);
      }
    },

    async load(checkpointId: string): Promise<CheckpointData | null> {
      const data = await state.storage.get<CheckpointData>(`checkpoint:${checkpointId}`);
      if (!data) return null;

      if (Date.now() > data.expiresAt) {
        await state.storage.delete(`checkpoint:${checkpointId}`);
        return null;
      }

      return data;
    },

    async delete(checkpointId: string): Promise<void> {
      const data = await state.storage.get<CheckpointData>(`checkpoint:${checkpointId}`);
      if (!data) return;

      await state.storage.delete(`checkpoint:${checkpointId}`);

      const taskIndexRaw = await state.storage.get<string[]>(`task_index:${data.taskId}`);
      if (taskIndexRaw) {
        const idx = taskIndexRaw.indexOf(checkpointId);
        if (idx >= 0) {
          taskIndexRaw.splice(idx, 1);
          if (taskIndexRaw.length === 0) {
            await state.storage.delete(`task_index:${data.taskId}`);
          } else {
            await state.storage.put(`task_index:${data.taskId}`, taskIndexRaw);
          }
        }
      }
    },

    async list(taskId: string): Promise<CheckpointData[]> {
      const taskIndexRaw = await state.storage.get<string[]>(`task_index:${taskId}`);
      if (!taskIndexRaw) return [];

      const checkpoints: CheckpointData[] = [];
      const now = Date.now();

      for (const checkpointId of taskIndexRaw) {
        const data = await state.storage.get<CheckpointData>(`checkpoint:${checkpointId}`);
        if (data && now <= data.expiresAt) {
          checkpoints.push(data);
        }
      }

      return checkpoints;
    },

    async gc(): Promise<void> {
      const now = Date.now();

      const taskIndexEntries = await state.storage.list<unknown>({
        start: "task_index:",
        end: "task_index:\xff",
      });

      for (const [key, value] of taskIndexEntries) {
        const taskIndex = value as string[];
        const validCheckpoints: string[] = [];

        for (const checkpointId of taskIndex) {
          const data = await state.storage.get<CheckpointData>(`checkpoint:${checkpointId}`);
          if (data && now <= data.expiresAt) {
            validCheckpoints.push(checkpointId);
          } else {
            await state.storage.delete(`checkpoint:${checkpointId}`);
          }
        }

        if (validCheckpoints.length === 0) {
          await state.storage.delete(key);
        } else {
          await state.storage.put(key, validCheckpoints);
        }
      }
    },
  };
}

export async function saveCheckpoint(
  requestId: string,
  taskId: string,
  iteration: number,
  url?: string,
  pageState?: string
): Promise<string> {
  const checkpointId = `${taskId}-${iteration}`;
  const now = Date.now();
  
  const data: CheckpointData = {
    checkpointId,
    taskId,
    iteration,
    url,
    pageState,
    timestamp: now,
    expiresAt: now + CHECKPOINT_TTL,
  };
  
  await getCheckpointStore().save(data);
  log(requestId, "debug", "Checkpoint saved", { checkpointId, iteration });
  return checkpointId;
}

export async function loadCheckpoint(checkpointId: string): Promise<CheckpointData | null> {
  return getCheckpointStore().load(checkpointId);
}

function checkCircuitBreaker(): void {
  if (circuitState.state === "open") {
    const timeSinceFailure = Date.now() - circuitState.lastFailure;
    if (timeSinceFailure >= CIRCUIT_RESET_TIMEOUT) {
      circuitState.state = "half-open";
      log("system", "info", "Circuit breaker half-open (testing recovery)");
    } else {
      throw new BrowserError({ 
        reason: "Circuit breaker is open - container may be unhealthy",
        requestId: "system"
      });
    }
  }
}

// ============================================================================
// Concurrent request handling (semaphore)
// ============================================================================

let activeRequests = 0;
const requestQueue: Array<() => void> = [];

export function acquireSemaphore(): Promise<void> {
  const config = getConfig();
  if (activeRequests < config.maxConcurrent) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => requestQueue.push(resolve));
}

export function releaseSemaphore(): void {
  activeRequests--;
  const next = requestQueue.shift();
  if (next) {
    activeRequests++;
    next();
  }
}

export function getActiveRequestCount(): number {
  return activeRequests;
}

// ============================================================================
// Container binding & fetch
// ============================================================================

let _containerBinding: any = null;
let _containerFetch: ((path: string, body?: object) => Promise<any>) | null = null;
let _containerUrl: string | null = null;  // For local dev override

export function setContainerBinding(binding: any) {
  _containerBinding = binding;
}

export function setContainerFetch(fetchFn: ((path: string, body?: object) => Promise<any>) | null) {
  _containerFetch = fetchFn;
}

export function setContainerUrl(url: string) {
  _containerUrl = url;
}

function getContainerUrl(): string | null {
  return _containerUrl || null;
}

async function containerFetch(
  requestId: string,
  path: string,
  body?: object
): Promise<any> {
  const containerUrl = getContainerUrl();
  log(requestId, "debug", `containerFetch: ${path}`, { 
    hasContainerFetch: !!_containerFetch, 
    hasContainerBinding: !!_containerBinding,
    hasContainerUrl: !!containerUrl,
    containerUrl 
  });
  
  // Use custom fetch if set (for testing)
  if (_containerFetch) {
    log(requestId, "debug", `Using custom containerFetch: ${path}`);
    return _containerFetch(path, body);
  }
  
  // Local dev mode: use direct URL to container server
  if (containerUrl) {
    const url = `${containerUrl}${path}`;
    log(requestId, "debug", `Using local container: ${url}`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        log(requestId, "error", `containerFetch error: ${path}`, { status: res.status, error: errorText });
        recordFailure();
        throw new Error(`${path} failed (${res.status}): ${errorText}`);
      }
      
      recordSuccess();
      return res.json();
    } catch (e) {
      log(requestId, "error", `containerFetch exception: ${path}`, { error: String(e) });
      recordFailure();
      throw e;
    }
  }
  
  // Check circuit breaker
  checkCircuitBreaker();
  
  if (!_containerBinding) {
    const error = new BrowserError({ 
      reason: "Container binding not set - did you call setContainerBinding()?",
      requestId 
    });
    log(requestId, "error", "No container binding", { reason: error.reason });
    throw error;
  }
  
  try {
    const { getContainer, switchPort } = await import("@cloudflare/containers");
    const container = getContainer(_containerBinding, crypto.randomUUID());
    
    const res = await container.fetch(
      switchPort(
        new Request(`http://container${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        }),
        8080
      )
    );
    
    if (!res.ok) {
      const errorText = await res.text();
      log(requestId, "error", `containerFetch error: ${path}`, { status: res.status, error: errorText });
      recordFailure();
      throw new Error(`${path} failed (${res.status}): ${errorText}`);
    }
    
    recordSuccess();
    return res.json();
  } catch (e) {
    log(requestId, "error", `containerFetch exception: ${path}`, { error: String(e) });
    recordFailure();
    throw e;
  }
}

// ============================================================================
// Core: doThis with Effect
// ============================================================================

export function doThis(
  prompt: string,
  opts: RalphOptions = {},
  requestId: string = generateRequestId()
): Effect.Effect<RalphResult, 
  ValidationError | MaxIterationsError | TimeoutError | BrowserError | RateLimitError | InternalError,
  never
> {
  return Effect.gen(function* () {
    const config = getConfig();
    log(requestId, "info", "Starting doThis");
    
    const validatedPrompt = validateString(prompt, config.maxPromptLength, "prompt");
    const max = validatePositiveInt(opts.maxIterations, 10, "maxIterations");
    const timeout = validatePositiveInt(opts.timeout, config.requestTimeout, "timeout");
    
    // Acquire semaphore
    yield* Effect.tryPromise({
      try: () => acquireSemaphore(),
      catch: (e) => new InternalError(requestId, "Semaphore error")
    });
    
    // Release semaphore on exit (using try/finally pattern via Effect)
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        releaseSemaphore();
      }
    };
    
    const taskId = opts.resumeFrom?.split("-")[0] || crypto.randomUUID();
    
    try {
      const checkpointId = `${taskId}-0`;
      
      const response = yield* Effect.timeout(
        Effect.tryPromise({
          try: () => containerFetch(requestId, "/do", { prompt: validatedPrompt }),
          catch: (e) => new BrowserError({ 
            reason: e instanceof Error ? e.message : "action failed",
            requestId 
          })
        }),
        timeout
      ).pipe(Effect.catchAll(() => 
        Effect.fail(new TimeoutError({ duration: timeout, requestId }))
      ));
      
      if (response?.success) {
        yield* Effect.ignore(
          Effect.tryPromise({
            try: () => saveCheckpoint(requestId, taskId, response.iterations || 1),
            catch: () => undefined
          })
        );
        log(requestId, "info", "Task completed", { iterations: response.iterations || 1 });
        return { 
          success: true, 
          message: "Task completed",
          data: response.data,
          iterations: response.iterations || 1, 
          checkpointId,
          requestId 
        };
      }
      
      log(requestId, "error", "Task failed", { error: response?.error });
      return yield* Effect.fail(new BrowserError({ 
        reason: response?.error || "Task failed",
        requestId 
      }));
    } finally {
      release();
    }
  });
}

// ============================================================================
// Convenience: run without Effect context
// ============================================================================

export async function run(
  prompt: string,
  opts?: RalphOptions,
  requestId?: string
): Promise<RalphResult> {
  return Effect.runPromise(doThis(prompt, opts, requestId || generateRequestId()));
}

// ============================================================================
// HTTP Handlers for Cloudflare Workers
// ============================================================================

import { Hono } from "hono";

interface ErrorResponse {
  error: string;
  tag: string;
  retryAfter?: number;
}

function createErrorResponse(error: unknown, requestId: string): ErrorResponse {
  // Handle Effect's FiberFailure wrapper
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : "";
  
  // Check for wrapped ValidationError
  if (errorMessage.includes("ValidationError")) {
    // Extract reason from message
    const reasonMatch = errorMessage.match(/ValidationError:\s*(.*?)(?:\n|$)/);
    const reason = reasonMatch ? reasonMatch[1] : "Validation failed";
    return { error: reason, tag: "ValidationError" };
  }
  if (error instanceof ValidationError) {
    return { error: error.reason, tag: "ValidationError" };
  }
  if (error instanceof UnauthorizedError) {
    return { error: "Unauthorized", tag: "UnauthorizedError" };
  }
  if (error instanceof RateLimitError) {
    return { error: "Rate limit exceeded", tag: "RateLimitError", retryAfter: error.retryAfter };
  }
  if (error instanceof MaxIterationsError) {
    return { error: "Task exceeded maximum iterations", tag: "MaxIterationsError" };
  }
  if (error instanceof TimeoutError) {
    return { error: "Task timed out", tag: "TimeoutError" };
  }
  if (error instanceof BrowserError) {
    log(requestId, "error", "Browser error", { reason: error.reason });
    return { error: "Browser operation failed", tag: "BrowserError" };
  }
  log(requestId, "error", "Unknown error", { error: errorMessage, stack: errorStack });
  return { error: errorMessage || "Internal error", tag: "InternalError" };
}

function getStatusFromTag(tag: string): number {
  const map: Record<string, number> = {
    ValidationError: 400,
    UnauthorizedError: 401,
    RateLimitError: 429,
    MaxIterationsError: 408,
    TimeoutError: 504,
    BrowserError: 502,
    InternalError: 500,
  };
  return map[tag] || 500;
}

export function createHandlers() {
  const app = new Hono();

  app.use("/*", async (c, next) => {
    const env = c.env as Record<string, unknown>;
    const apiKey = typeof env.RALPH_API_KEY === "string" ? env.RALPH_API_KEY : "";
    const enableCors = apiKey === "" || env.RALPH_ENABLE_CORS === "true";

    if (!enableCors) {
      await next();
      return;
    }
    const origin = c.req.header("origin") || "*";
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, X-Request-Id, X-Api-Key");
    c.header("Access-Control-Max-Age", "86400");

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }
    await next();
  });

  // Health check - no auth required
  app.get("/health", async (c) => {
    return c.json({
      status: "healthy",
      activeRequests: getActiveRequestCount(),
      queueLength: requestQueue.length,
      timestamp: new Date().toISOString(),
    });
  });
  
  // Main execution endpoint
  app.post("/do", async (c) => {
    const requestId = c.req.header("x-request-id") || generateRequestId();
    const clientIp = c.req.header("cf-connecting-ip") || "unknown";
    
    try {
      checkRateLimit(clientIp);
    } catch (e) {
      if (e instanceof RateLimitError) {
        log(requestId, "warn", "Rate limit exceeded", { ip: clientIp });
        return c.json({ 
          error: "Rate limit exceeded", 
          tag: "RateLimitError", 
          retryAfter: e.retryAfter 
        }, 429 as any);
      }
      throw e;
    }

    const env = c.env as Record<string, unknown>;
    const apiKey = typeof env.RALPH_API_KEY === "string" ? env.RALPH_API_KEY : "";
    if (apiKey) {
      const requestApiKey = c.req.header("x-api-key");
      if (!requestApiKey || requestApiKey !== apiKey) {
        log(requestId, "warn", "Unauthorized access attempt", { ip: clientIp });
        return c.json({ error: "Unauthorized", tag: "UnauthorizedError" }, 401 as any);
      }
    }

    let body: { prompt?: unknown; options?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON", tag: "ValidationError" }, 400 as any);
    }
    
    try {
      const result = await run(
        String(body.prompt ?? ""), 
        body.options as RalphOptions | undefined,
        requestId
      );
      log(requestId, "info", "Request completed", { success: result.success });
      return c.json(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : "";
      const errorName = e instanceof Error ? e.name : "Unknown";
      log(requestId, "error", "Request failed", { error: errorMessage, stack: errorStack, errorName, errorType: typeof e });
      console.error("Full error:", e);
      const errorResponse = createErrorResponse(e, requestId);
      return c.json(errorResponse, getStatusFromTag(errorResponse.tag) as any);
    }
  });
  
  // Resume from checkpoint
  app.post("/resume/:checkpointId", async (c) => {
    const requestId = c.req.header("x-request-id") || generateRequestId();
    const checkpointId = c.req.param("checkpointId");
    
    if (!checkpointId || checkpointId.includes("..") || checkpointId.includes("/")) {
      return c.json({ error: "Invalid checkpoint ID", tag: "ValidationError" }, 400 as any);
    }
    
    try {
      const result = await run("", { resumeFrom: checkpointId }, requestId);
      return c.json(result);
    } catch (e) {
      const errorResponse = createErrorResponse(e, requestId);
      return c.json(errorResponse, getStatusFromTag(errorResponse.tag) as any);
    }
  });
  
  // Get status
  app.get("/status/:taskId", async (c) => {
    return c.json({ 
      status: "unknown",
      activeRequests: getActiveRequestCount(),
      queueLength: requestQueue.length,
    });
  });
  
  return app;
}
