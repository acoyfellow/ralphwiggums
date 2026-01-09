/**
 * ralphwiggums - Core
 * Effect-first browser automation with OpenCode Zen.
 * Production-ready with secure-by-default configuration.
 */
import { Effect, Data } from "effect";
// ============================================================================
// Configuration
// ============================================================================
// ============================================================================
// Simple validation without full Zod dependency
// ============================================================================
function validateString(value, maxLength, field) {
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
function validatePositiveInt(value, defaultValue, field) {
    if (value === undefined || value === null)
        return defaultValue;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
        throw new ValidationError({ field, reason: `${field} must be a non-negative number` });
    }
    return num;
}
// ============================================================================
// Errors
// ============================================================================
export class ValidationError extends Data.TaggedError("ValidationError") {
}
export class MaxIterationsError extends Data.TaggedError("MaxIterationsError") {
}
export class TimeoutError extends Data.TaggedError("TimeoutError") {
}
export class BrowserError extends Data.TaggedError("BrowserError") {
}
export class RateLimitError extends Data.TaggedError("RateLimitError") {
}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError") {
}
class InternalError extends Data.TaggedError("InternalError") {
    requestId;
    message;
    constructor(requestId, message) {
        super();
        this.requestId = requestId;
        this.message = message;
    }
}
// ============================================================================
// Configuration (secure by default)
// ============================================================================
function getEnv(key, defaultValue) {
    return typeof process !== "undefined" && process.env?.[key]
        ? process.env[key]
        : defaultValue;
}
export function getConfig() {
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
export function generateRequestId() {
    return `rw_${Date.now()}_${++requestCounter % 100000}`;
}
export function log(requestId, level, message, meta) {
    const config = getConfig();
    if (!config.debug && level === "debug")
        return;
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        requestId,
        message,
    };
    if (meta)
        entry.meta = meta;
    if (level === "error")
        console.error(JSON.stringify(entry));
    else
        console.log(JSON.stringify(entry));
}
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 60;
function checkRateLimit(ip) {
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
        if (now > entry.resetAt)
            rateLimitMap.delete(ip);
    }
}
const CIRCUIT_FAILURE_THRESHOLD = 5; // Failures before opening
const CIRCUIT_RESET_TIMEOUT = 30000; // 30 seconds before trying again
let circuitState = {
    state: "closed",
    lastFailure: 0,
    failureCount: 0,
};
export function getCircuitState() {
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
// Re-export DO checkpoint storage
export { CheckpointDO, createInMemoryCheckpointStore, } from "./checkpoint-do.js";
// In-memory store for single-instance deployment
const checkpointStore = new Map();
const TASK_CHECKPOINTS = new Map();
const CHECKPOINT_TTL = 3600000; // 1 hour
export function getCheckpointStore() {
    return {
        async save(data) {
            checkpointStore.set(data.checkpointId, data);
            const taskCheckpoints = TASK_CHECKPOINTS.get(data.taskId) || [];
            if (!taskCheckpoints.includes(data.checkpointId)) {
                taskCheckpoints.push(data.checkpointId);
                TASK_CHECKPOINTS.set(data.taskId, taskCheckpoints);
            }
        },
        async load(checkpointId) {
            return checkpointStore.get(checkpointId) || null;
        },
        async delete(checkpointId) {
            const data = checkpointStore.get(checkpointId);
            if (data) {
                checkpointStore.delete(checkpointId);
                const taskCheckpoints = TASK_CHECKPOINTS.get(data.taskId);
                if (taskCheckpoints) {
                    const idx = taskCheckpoints.indexOf(checkpointId);
                    if (idx >= 0)
                        taskCheckpoints.splice(idx, 1);
                }
            }
        },
        async list(taskId) {
            const checkpointIds = TASK_CHECKPOINTS.get(taskId) || [];
            return checkpointIds
                .map(id => checkpointStore.get(id))
                .filter((c) => c !== undefined);
        },
        async gc() {
            const now = Date.now();
            for (const [id, data] of checkpointStore.entries()) {
                if (now > data.expiresAt) {
                    checkpointStore.delete(id);
                    const taskCheckpoints = TASK_CHECKPOINTS.get(data.taskId);
                    if (taskCheckpoints) {
                        const idx = taskCheckpoints.indexOf(id);
                        if (idx >= 0)
                            taskCheckpoints.splice(idx, 1);
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
export function createDOCheckpointStore(state) {
    return {
        async save(data) {
            await state.storage.put(`checkpoint:${data.checkpointId}`, data);
            const taskIndexRaw = await state.storage.get(`task_index:${data.taskId}`);
            const taskIndex = taskIndexRaw || [];
            if (!taskIndex.includes(data.checkpointId)) {
                taskIndex.push(data.checkpointId);
                await state.storage.put(`task_index:${data.taskId}`, taskIndex);
            }
        },
        async load(checkpointId) {
            const data = await state.storage.get(`checkpoint:${checkpointId}`);
            if (!data)
                return null;
            if (Date.now() > data.expiresAt) {
                await state.storage.delete(`checkpoint:${checkpointId}`);
                return null;
            }
            return data;
        },
        async delete(checkpointId) {
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
        },
        async list(taskId) {
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
        },
        async gc() {
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
        },
    };
}
export async function saveCheckpoint(requestId, taskId, iteration, url, pageState) {
    const checkpointId = `${taskId}-${iteration}`;
    const now = Date.now();
    const data = {
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
export async function loadCheckpoint(checkpointId) {
    return getCheckpointStore().load(checkpointId);
}
function checkCircuitBreaker() {
    if (circuitState.state === "open") {
        const timeSinceFailure = Date.now() - circuitState.lastFailure;
        if (timeSinceFailure >= CIRCUIT_RESET_TIMEOUT) {
            circuitState.state = "half-open";
            log("system", "info", "Circuit breaker half-open (testing recovery)");
        }
        else {
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
const requestQueue = [];
export function acquireSemaphore() {
    const config = getConfig();
    if (activeRequests < config.maxConcurrent) {
        activeRequests++;
        return Promise.resolve();
    }
    return new Promise((resolve) => requestQueue.push(resolve));
}
export function releaseSemaphore() {
    activeRequests--;
    const next = requestQueue.shift();
    if (next) {
        activeRequests++;
        next();
    }
}
export function getActiveRequestCount() {
    return activeRequests;
}
// ============================================================================
// Container binding & fetch
// ============================================================================
let _containerBinding = null;
let _containerFetch = null;
let _containerUrl = null; // For local dev override
export function setContainerBinding(binding) {
    _containerBinding = binding;
}
export function setContainerFetch(fetchFn) {
    _containerFetch = fetchFn;
}
export function setContainerUrl(url) {
    _containerUrl = url;
}
function getContainerUrl() {
    return _containerUrl || null;
}
async function containerFetch(requestId, path, body) {
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
        }
        catch (e) {
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
        const res = await container.fetch(switchPort(new Request(`http://container${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
        }), 8080));
        if (!res.ok) {
            const errorText = await res.text();
            log(requestId, "error", `containerFetch error: ${path}`, { status: res.status, error: errorText });
            recordFailure();
            throw new Error(`${path} failed (${res.status}): ${errorText}`);
        }
        recordSuccess();
        return res.json();
    }
    catch (e) {
        log(requestId, "error", `containerFetch exception: ${path}`, { error: String(e) });
        recordFailure();
        throw e;
    }
}
// ============================================================================
// Core: doThis with Effect
// ============================================================================
export function doThis(prompt, opts = {}, requestId = generateRequestId()) {
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
            const response = yield* Effect.timeout(Effect.tryPromise({
                try: () => containerFetch(requestId, "/do", { prompt: validatedPrompt }),
                catch: (e) => new BrowserError({
                    reason: e instanceof Error ? e.message : "action failed",
                    requestId
                })
            }), timeout).pipe(Effect.catchAll(() => Effect.fail(new TimeoutError({ duration: timeout, requestId }))));
            if (response?.success) {
                yield* Effect.ignore(Effect.tryPromise({
                    try: () => saveCheckpoint(requestId, taskId, response.iterations || 1),
                    catch: () => undefined
                }));
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
        }
        finally {
            release();
        }
    });
}
// ============================================================================
// Convenience: run without Effect context
// ============================================================================
export async function run(prompt, opts, requestId) {
    return Effect.runPromise(doThis(prompt, opts, requestId || generateRequestId()));
}
// ============================================================================
// HTTP Handlers for Cloudflare Workers
// ============================================================================
import { Hono } from "hono";
function createErrorResponse(error, requestId) {
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
function getStatusFromTag(tag) {
    const map = {
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
        const env = c.env;
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
        }
        catch (e) {
            if (e instanceof RateLimitError) {
                log(requestId, "warn", "Rate limit exceeded", { ip: clientIp });
                return c.json({
                    error: "Rate limit exceeded",
                    tag: "RateLimitError",
                    retryAfter: e.retryAfter
                }, 429);
            }
            throw e;
        }
        const env = c.env;
        const apiKey = typeof env.RALPH_API_KEY === "string" ? env.RALPH_API_KEY : "";
        if (apiKey) {
            const requestApiKey = c.req.header("x-api-key");
            if (!requestApiKey || requestApiKey !== apiKey) {
                log(requestId, "warn", "Unauthorized access attempt", { ip: clientIp });
                return c.json({ error: "Unauthorized", tag: "UnauthorizedError" }, 401);
            }
        }
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: "Invalid JSON", tag: "ValidationError" }, 400);
        }
        try {
            const result = await run(String(body.prompt ?? ""), body.options, requestId);
            log(requestId, "info", "Request completed", { success: result.success });
            return c.json(result);
        }
        catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            const errorStack = e instanceof Error ? e.stack : "";
            const errorName = e instanceof Error ? e.name : "Unknown";
            log(requestId, "error", "Request failed", { error: errorMessage, stack: errorStack, errorName, errorType: typeof e });
            console.error("Full error:", e);
            const errorResponse = createErrorResponse(e, requestId);
            return c.json(errorResponse, getStatusFromTag(errorResponse.tag));
        }
    });
    // Resume from checkpoint
    app.post("/resume/:checkpointId", async (c) => {
        const requestId = c.req.header("x-request-id") || generateRequestId();
        const checkpointId = c.req.param("checkpointId");
        if (!checkpointId || checkpointId.includes("..") || checkpointId.includes("/")) {
            return c.json({ error: "Invalid checkpoint ID", tag: "ValidationError" }, 400);
        }
        try {
            const result = await run("", { resumeFrom: checkpointId }, requestId);
            return c.json(result);
        }
        catch (e) {
            const errorResponse = createErrorResponse(e, requestId);
            return c.json(errorResponse, getStatusFromTag(errorResponse.tag));
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
//# sourceMappingURL=index.js.map