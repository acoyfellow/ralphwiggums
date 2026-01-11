/**
 * Browser Pool Management for Orchestrator
 *
 * Effect-based pool that manages container availability and health.
 * Delegates actual browser lifecycle to containers via /do endpoint.
 */
import { Effect, Data } from "effect";
// ============================================================================
// Errors
// ============================================================================
export class PoolError extends Data.TaggedError("PoolError") {
}
export class PoolExhaustedError extends Data.TaggedError("PoolExhaustedError") {
}
// ============================================================================
// Pool Implementation
// ============================================================================
/**
 * Create a new browser pool with containers
 */
export function createPool(containerUrls, maxSize = 20) {
    return Effect.succeed({
        instances: containerUrls.map((url, index) => ({
            id: `container-${index}`,
            status: "available",
            lastHealthCheck: Date.now(),
            currentTaskId: undefined,
            url,
        })),
        maxSize,
        availableCount: containerUrls.length,
        busyCount: 0,
        unhealthyCount: 0,
    });
}
/**
 * Perform concurrent health checks on all pool instances
 */
export function healthCheckPool(pool) {
    const healthChecks = pool.instances.map(instance => {
        if (!instance.url) {
            return Effect.succeed(instance);
        }
        return checkContainerHealth(instance.url).pipe(Effect.map(isHealthy => {
            instance.status = isHealthy ? "available" : "unhealthy";
            instance.lastHealthCheck = Date.now();
            return instance;
        }), Effect.catchAll(error => {
            instance.status = "unhealthy";
            instance.lastHealthCheck = Date.now();
            return Effect.succeed(instance);
        }));
    });
    return Effect.all(healthChecks, { concurrency: pool.instances.length }).pipe(Effect.map(() => {
        pool.availableCount = pool.instances.filter(i => i.status === "available").length;
        pool.busyCount = pool.instances.filter(i => i.status === "busy").length;
        pool.unhealthyCount = pool.instances.filter(i => i.status === "unhealthy").length;
    }), Effect.mapError(() => new PoolError({ reason: "Health check failed" })));
}
/**
 * Find an available browser instance
 */
export function findAvailableBrowser(pool) {
    const available = pool.instances.find(i => i.status === "available");
    if (!available) {
        return Effect.fail(new PoolExhaustedError({
            requested: 1,
            available: pool.availableCount
        }));
    }
    return Effect.succeed(available);
}
/**
 * Mark browser as busy
 */
export function markBrowserBusy(pool, browserId, taskId) {
    const browser = pool.instances.find(i => i.id === browserId);
    if (!browser) {
        return Effect.fail(new PoolError({ reason: `Browser ${browserId} not found` }));
    }
    if (browser.status !== "available") {
        return Effect.fail(new PoolError({ reason: `Browser ${browserId} is not available` }));
    }
    browser.status = "busy";
    browser.currentTaskId = taskId;
    pool.availableCount--;
    return Effect.succeed(undefined);
}
/**
 * Mark browser as available
 */
export function markBrowserAvailable(pool, browserId) {
    const browser = pool.instances.find(i => i.id === browserId);
    if (!browser) {
        return Effect.fail(new PoolError({ reason: `Browser ${browserId} not found` }));
    }
    browser.status = "available";
    browser.currentTaskId = undefined;
    pool.availableCount++;
    return Effect.succeed(undefined);
}
/**
 * Get pool status
 */
export function getPoolStatus(pool) {
    return {
        size: pool.instances.length,
        maxSize: pool.maxSize,
        available: pool.availableCount,
        busy: pool.instances.filter(i => i.status === "busy").length,
        unhealthy: pool.instances.filter(i => i.status === "unhealthy").length,
    };
}
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Check if a container is healthy by calling its health endpoint
 */
function checkContainerHealth(containerUrl) {
    const healthCheck = Effect.tryPromise({
        try: async () => {
            const response = await fetch(`${containerUrl}/health`);
            if (!response.ok) {
                return false;
            }
            const data = await response.json();
            return data?.status === "healthy";
        },
        catch: () => false
    });
    return healthCheck.pipe(
    // Use Effect.timeout instead of setTimeout
    Effect.timeout("5 seconds"), Effect.catchAll(() => Effect.succeed(false).pipe(Effect.tap(() => Effect.sync(() => console.warn(`Health check failed for ${containerUrl}`))))), Effect.mapError(() => new PoolError({
        reason: `Health check failed for ${containerUrl}`
    })));
}
//# sourceMappingURL=pool.js.map