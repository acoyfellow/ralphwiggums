/**
 * Browser Pool Management for Orchestrator
 *
 * Effect-based pool that manages persistent browser instances.
 * Browsers are created once and reused across tasks for performance.
 * Pool owns browser lifecycle: create, health check, assign, cleanup.
 */

import { Effect, Data } from "effect";
import type { BrowserInstance, BrowserPool, OrchestratorDOState } from "./types.js";

// ============================================================================
// Errors
// ============================================================================

export class PoolError extends Data.TaggedError("PoolError")<{
  reason: string;
  browserId?: string;
}> {}

export class PoolExhaustedError extends Data.TaggedError("PoolExhaustedError")<{
  requested: number;
  available: number;
}> {}

export type { BrowserInstance, BrowserPool };

// ============================================================================
// Pool Implementation
// ============================================================================

/**
 * Create a new browser pool with persistent browser instances
 * Uses Effect.all for concurrent browser creation
 */
export function createPool(
  size: number = 5
): Effect.Effect<BrowserPool, PoolError, never> {
  const createBrowsers = Array.from({ length: size }, (_, index) =>
    createBrowserInstance(`browser-${index}`)
  );

  return Effect.all(createBrowsers, { concurrency: size }).pipe(
    Effect.map((instances: BrowserInstance[]) => ({
      instances,
      maxSize: size,
      availableCount: instances.filter((i: BrowserInstance) => i.status === "available").length,
      busyCount: 0,
      unhealthyCount: 0,
    })),
    Effect.mapError((error: PoolError) => new PoolError({ reason: `Failed to create browser pool: ${error.reason}` }))
  );
}

/**
 * Perform concurrent health checks on all browser instances
 * Uses Effect.all for parallel health checks
 */
export function healthCheckPool(
  pool: BrowserPool
): Effect.Effect<void, PoolError, never> {
  const healthChecks = pool.instances.map(instance =>
    checkBrowserHealth(instance).pipe(
      Effect.map(isHealthy => {
        instance.status = isHealthy ? "available" : "unhealthy";
        instance.lastHealthCheck = Date.now();
        return instance;
      }),
      Effect.catchAll(() => {
        instance.status = "unhealthy";
        instance.lastHealthCheck = Date.now();
        return Effect.succeed(instance);
      })
    )
  );

  return Effect.all(healthChecks, { concurrency: pool.instances.length }).pipe(
    Effect.map(() => {
      pool.availableCount = pool.instances.filter((i: BrowserInstance) => i.status === "available").length;
      pool.busyCount = pool.instances.filter((i: BrowserInstance) => i.status === "busy").length;
      pool.unhealthyCount = pool.instances.filter((i: BrowserInstance) => i.status === "unhealthy").length;
    }),
    Effect.mapError(() => new PoolError({ reason: "Health check failed" }))
  );
}

/**
 * Find an available browser instance
 */
export function findAvailableBrowser(
  pool: BrowserPool
): Effect.Effect<BrowserInstance, PoolExhaustedError, never> {
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
 * Acquire a browser instance for task execution using Effect
 */
export function acquireBrowser(
  pool: BrowserPool,
  taskId: string
): Effect.Effect<BrowserInstance, PoolError | PoolExhaustedError, never> {
  return findAvailableBrowser(pool).pipe(
    Effect.flatMap(browser => {
      browser.status = "busy";
      browser.currentTaskId = taskId;
      pool.availableCount--;
      pool.busyCount++;
      return Effect.succeed(browser);
    })
  );
}

/**
 * Release a browser instance back to the pool using Effect
 */
export function releaseBrowser(
  pool: BrowserPool,
  browserId: string
): Effect.Effect<void, PoolError, never> {
  const browser = pool.instances.find(i => i.id === browserId);

  if (!browser) {
    return Effect.fail(new PoolError({ reason: `Browser ${browserId} not found` }));
  }

  browser.status = "available";
  browser.currentTaskId = undefined;
  pool.availableCount++;
  pool.busyCount--;

  return Effect.succeed(undefined);
}

/**
 * Get pool status
 */
export function getPoolStatus(pool: BrowserPool) {
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
 * Create a new browser instance with Playwright
 */
function createBrowserInstance(id: string): Effect.Effect<BrowserInstance, PoolError, never> {
  return Effect.tryPromise({
    try: async () => {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      return {
        id,
        status: "available" as const,
        lastHealthCheck: Date.now(),
        currentTaskId: undefined,
        browser,
        context,
        page,
      };
    },
    catch: (error) => {
      throw new PoolError({
        reason: `Failed to create browser instance ${id}: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
}

/**
 * Check if a browser instance is healthy
 */
function checkBrowserHealth(instance: BrowserInstance): Effect.Effect<boolean, PoolError, never> {
  if (!instance.page) {
    return Effect.succeed(false);
  }

  return Effect.tryPromise({
    try: async () => {
      // Simple health check: try to get page title
      await instance.page!.title();
      return true;
    },
    catch: () => false
  }).pipe(
    Effect.timeout("10 seconds"),
    Effect.catchAll(() => Effect.succeed(false)),
    Effect.mapError(() => new PoolError({
      reason: `Health check failed for browser ${instance.id}`
    }))
  );
}