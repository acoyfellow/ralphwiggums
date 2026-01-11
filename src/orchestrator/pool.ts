/**
 * Browser Pool Management for Orchestrator
 *
 * Effect-based pool that manages persistent browser instances.
 * Browsers are created once and reused across tasks for performance.
 * Pool owns browser lifecycle: create, health check, assign, cleanup.
 */

import { Effect, Data } from "effect";
import type { BrowserInstance, BrowserPool, OrchestratorDOState } from "./types.js";
import type { ReliableScheduler } from "ironalarm";

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
// Auto-scaling
// ============================================================================

export interface AutoScalingConfig {
  minSize: number;
  maxSize: number;
  scaleUpThreshold: number; // Queue depth > available * scaleUpThreshold triggers scale up
  scaleDownThreshold: number; // Utilization < scaleDownThreshold triggers scale down
  scaleDownDelayMs: number; // How long to wait before scaling down
  checkIntervalMs: number; // How often to check for scaling decisions
}

const defaultConfig: AutoScalingConfig = {
  minSize: 1,
  maxSize: 20,
  scaleUpThreshold: 2, // Queue > available * 2
  scaleDownThreshold: 0.5, // Utilization < 50%
  scaleDownDelayMs: 300000, // 5 minutes
  checkIntervalMs: 10000, // 10 seconds
};

export class ScalingError extends Data.TaggedError("ScalingError")<{
  reason: string;
}> {}

/**
 * Add a new browser instance to the pool
 */
export function scalePoolUp(
  pool: BrowserPool,
  count: number = 1
): Effect.Effect<number, ScalingError, never> {
  return Effect.gen(function* () {
    const currentSize = pool.instances.length;
    const newSize = Math.min(currentSize + count, pool.maxSize);
    const actualAdded = newSize - currentSize;

    if (actualAdded === 0) {
      return 0;
    }

    const createBrowsers = Array.from({ length: actualAdded }, (_, index) =>
      createBrowserInstance(`browser-${currentSize + index}`)
    );

    const newInstances = yield* Effect.all(createBrowsers, { concurrency: actualAdded }).pipe(
      Effect.mapError(error => new ScalingError({ reason: `Failed to create browsers: ${error.reason}` }))
    );

    for (const instance of newInstances) {
      pool.instances.push(instance);
    }

    pool.availableCount += actualAdded;

    console.log(`Pool scaled up: +${actualAdded} browsers (size: ${pool.instances.length})`);
    return actualAdded;
  });
}

/**
 * Remove unhealthy/available browser instances from the pool
 */
export function scalePoolDown(
  pool: BrowserPool,
  count: number = 1,
  minSize: number = defaultConfig.minSize
): Effect.Effect<number, ScalingError, never> {
  return Effect.gen(function* () {
    const currentSize = pool.instances.length;
    const newSize = Math.max(currentSize - count, minSize);
    const actualRemoved = currentSize - newSize;

    if (actualRemoved === 0) {
      return 0;
    }

    const availableToRemove = pool.instances
      .filter(i => i.status === "available")
      .slice(0, actualRemoved);

    const unhealthyToRemove = pool.instances
      .filter(i => i.status === "unhealthy" && !availableToRemove.includes(i))
      .slice(0, actualRemoved - availableToRemove.length);

    const toRemove = [...availableToRemove, ...unhealthyToRemove].slice(0, actualRemoved);

    // Close browser resources
    for (const instance of toRemove) {
      yield* Effect.sync(() => {
        instance.page?.close().catch(() => {});
        instance.context?.close().catch(() => {});
        instance.browser?.close().catch(() => {});
      });

      const idx = pool.instances.indexOf(instance);
      if (idx > -1) {
        pool.instances.splice(idx, 1);
      }
      if (instance.status === "available") {
        pool.availableCount--;
      }
    }

    console.log(`Pool scaled down: -${toRemove.length} browsers (size: ${pool.instances.length})`);
    return toRemove.length;
  });
}

/**
 * Check if pool should scale up based on queue depth
 */
function shouldScaleUp(
  queueDepth: number,
  availableBrowsers: number,
  config: AutoScalingConfig
): boolean {
  if (availableBrowsers === 0 && queueDepth > 0) {
    return true; // Always scale up if there are tasks but no available browsers
  }
  return queueDepth > availableBrowsers * config.scaleUpThreshold;
}

/**
 * Check if pool should scale down based on utilization
 */
function shouldScaleDown(
  queueDepth: number,
  busyBrowsers: number,
  totalBrowsers: number,
  idleTimeMs: number,
  config: AutoScalingConfig
): boolean {
  // Only scale down if queue is empty
  if (queueDepth > 0) {
    return false;
  }

  // Check utilization
  const utilization = totalBrowsers > 0 ? busyBrowsers / totalBrowsers : 0;
  if (utilization >= config.scaleDownThreshold) {
    return false;
  }

  // Must be idle for the configured delay
  return idleTimeMs >= config.scaleDownDelayMs;
}

/**
 * Auto-scaling loop that monitors queue and adjusts pool size
 * Uses Effect.sleep for delays, no setTimeout
 */
export function startAutoScaling(
  pool: BrowserPool,
  scheduler: ReliableScheduler,
  config: Partial<AutoScalingConfig> = {}
): Effect.Effect<void, never, never> {
  const finalConfig = { ...defaultConfig, ...config };

  let lastActivityTime = Date.now();
  let scalingInProgress = false;

  const loop: Effect.Effect<void, never, never> = Effect.gen(function* () {
    yield* Effect.sleep(finalConfig.checkIntervalMs);

    if (scalingInProgress) {
      return loop;
    }

    const tasks = yield* scheduler.getTasks("pending");
    const queueDepth = tasks.length;
    const status = getPoolStatus(pool);
    const totalBrowsers = status.size;
    const busyBrowsers = status.busy;
    const availableBrowsers = status.available;

    if (shouldScaleUp(queueDepth, availableBrowsers, finalConfig)) {
      const canAdd = finalConfig.maxSize - totalBrowsers;
      if (canAdd > 0) {
        scalingInProgress = true;
        const toAdd = Math.min(Math.ceil(queueDepth / 2), canAdd);
        yield* scalePoolUp(pool, toAdd).pipe(
          Effect.catchAll(error => {
            console.error(`Scale up failed: ${error.reason}`);
            return Effect.succeed(0);
          })
        );
        scalingInProgress = false;
        lastActivityTime = Date.now();
        return loop;
      }
    }

    const idleTimeMs = Date.now() - lastActivityTime;
    if (shouldScaleDown(queueDepth, busyBrowsers, totalBrowsers, idleTimeMs, finalConfig)) {
      const canRemove = totalBrowsers - finalConfig.minSize;
      if (canRemove > 0) {
        scalingInProgress = true;
        yield* scalePoolDown(pool, 1, finalConfig.minSize).pipe(
          Effect.catchAll(error => {
            console.error(`Scale down failed: ${error.reason}`);
            return Effect.succeed(0);
          })
        );
        scalingInProgress = false;
        return loop;
      }
    }

    if (queueDepth > 0 || busyBrowsers > 0) {
      lastActivityTime = Date.now();
    }

    return loop;
  });

  return loop;
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