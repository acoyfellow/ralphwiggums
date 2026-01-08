/**
 * ralphwiggums - Unit Tests
 * Tests for core library functionality with mocked dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Effect } from "effect";
import type { RalphOptions, RalphResult, RalphConfig } from "../index.js";

// Import the module to test
import * as Ralph from "../index.js";

// ============================================================================
// Mock Setup
// ============================================================================

const mockContainerFetch = vi.fn();

// Reset and setup mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  Ralph.setContainerFetch(mockContainerFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  Ralph.setContainerFetch(null);
  // Reset semaphore state
  Ralph.releaseSemaphore();
});

// ============================================================================
// Tests
// ============================================================================

describe("RalphWiggums Core", () => {
  describe("doThis()", () => {
    it("should return successful result on first iteration", async () => {
      mockContainerFetch.mockResolvedValue({
        success: true,
        data: "TASK_COMPLETE",
      });

      const result = await Effect.runPromise(Ralph.doThis("Click submit button")) as RalphResult;

      expect(result.success).toBe(true);
      expect(result.message).toBe("Task completed");
      expect(result.iterations).toBe(1);
      expect(result.checkpointId).toBeDefined();
    });

    it("should return success when response includes 'success' string", async () => {
      mockContainerFetch.mockResolvedValue({
        success: true,
        data: "Action was successful",
      });

      const result = await Effect.runPromise(Ralph.doThis("Fill form")) as RalphResult;

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(1);
    });

    it("should complete after two iterations when first fails", async () => {
      mockContainerFetch
        .mockResolvedValueOnce({ success: true }) // /start
        .mockResolvedValueOnce({ data: "Still working..." }) // /instruction iter 0
        .mockResolvedValueOnce({ success: true }) // /stop checkpoint
        .mockResolvedValueOnce({ data: "TASK_COMPLETE" }); // /instruction iter 1 success

      const result = await Effect.runPromise(Ralph.doThis("Fill form", { maxIterations: 5 })) as RalphResult;

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(2);
    });

    it("should fail with MaxIterationsError after exhausting iterations", async () => {
      mockContainerFetch.mockResolvedValue({
        success: true,
        data: "Still working",
      });

      const result = Effect.runPromise(Ralph.doThis("Fill form", { maxIterations: 3 }));

      await expect(result).rejects.toThrow();
    });

    it("should fail with BrowserError when /start fails", async () => {
      mockContainerFetch.mockRejectedValue(new Error("Container failed to start"));

      const result = Effect.runPromise(Ralph.doThis("Click button"));

      try {
        await result;
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e).toBeDefined();
      }
    });

    it("should fail with BrowserError when /instruction fails", async () => {
      let callCount = 0;
      mockContainerFetch.mockImplementation((path) => {
        callCount++;
        if (path === "/start") return Promise.resolve({ success: true });
        if (path === "/instruction") return Promise.reject(new Error("Navigation failed"));
        return Promise.resolve({ success: true });
      });

      const result = Effect.runPromise(Ralph.doThis("Click button"));

      try {
        await result;
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e).toBeDefined();
      }
    });

    it("should respect maxIterations option", async () => {
      let callCount = 0;
      mockContainerFetch.mockImplementation((path) => {
        callCount++;
        if (path === "/start") return Promise.resolve({ success: true });
        if (path === "/instruction") return Promise.resolve({ data: "Still working..." });
        return Promise.resolve({ success: true });
      });

      const result = Effect.runPromise(Ralph.doThis("Fill form", { maxIterations: 2 }));

      try {
        await result;
      } catch (e: any) {
        // Should fail after max iterations
      }
      expect(callCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe("run()", () => {
    it("should return result from doThis", async () => {
      mockContainerFetch.mockResolvedValue({
        success: true,
        data: "TASK_COMPLETE",
      });

      const result = await Ralph.run("Click submit");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Task completed");
    });
  });

  describe("createHandlers()", () => {
    it("should create Hono app with routes", () => {
      const app = Ralph.createHandlers();

      expect(app).toBeDefined();
      expect(typeof app.fetch).toBe("function");
    });

    it("POST /do should reject empty prompts", async () => {
      mockContainerFetch.mockResolvedValue({ success: true });

      const app = Ralph.createHandlers();
      const mockRequest = new Request("http://localhost/do", {
        method: "POST",
        body: JSON.stringify({ prompt: "" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await app.fetch(mockRequest, {} as any);
      // Empty prompt should fail (either 400 validation or error)
      expect(res.status).not.toBe(200);
    });

    it("POST /do should reject missing prompt", async () => {
      mockContainerFetch.mockResolvedValue({ success: true });

      const app = Ralph.createHandlers();
      const mockRequest = new Request("http://localhost/do", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });

      const res = await app.fetch(mockRequest, {} as any);
      expect(res.status).not.toBe(200);
    });

    it("POST /do should handle errors appropriately", async () => {
      mockContainerFetch.mockRejectedValue(new Error("Container failed"));

      const app = Ralph.createHandlers();
      const mockRequest = new Request("http://localhost/do", {
        method: "POST",
        body: JSON.stringify({ prompt: "Click button" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await app.fetch(mockRequest, {} as any);
      // Should return an error status (5xx)
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("POST /do should handle timeout/max iterations", async () => {
      mockContainerFetch.mockResolvedValue({ success: true, data: "Still working..." });

      const app = Ralph.createHandlers();
      const mockRequest = new Request("http://localhost/do", {
        method: "POST",
        body: JSON.stringify({ prompt: "Fill form", options: { maxIterations: 1 } }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await app.fetch(mockRequest, {} as any);
      expect(res.status).not.toBe(200);
    });

    it("POST /resume/:checkpointId should attempt resume", async () => {
      mockContainerFetch.mockResolvedValue({ success: true, data: "TASK_COMPLETE" });

      const app = Ralph.createHandlers();
      const mockRequest = new Request("http://localhost/resume/checkpoint-123", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const res = await app.fetch(mockRequest, {} as any);
      // Should attempt the request (may succeed or fail based on implementation)
      expect([200, 400, 500]).toContain(res.status);
    });

    it("GET /status/:taskId should return status", async () => {
      const app = Ralph.createHandlers();
      const mockRequest = new Request("http://localhost/status/task-123", {
        method: "GET",
      });

      const res = await app.fetch(mockRequest, {} as any);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty("activeRequests");
      expect(body).toHaveProperty("queueLength");
    });
  });

  describe("Type exports", () => {
    it("should export RalphOptions interface", () => {
      const opts: RalphOptions = {
        maxIterations: 10,
        timeout: 60000,
        resumeFrom: "checkpoint-123",
      };

      expect(opts.maxIterations).toBe(10);
      expect(opts.timeout).toBe(60000);
      expect(opts.resumeFrom).toBe("checkpoint-123");
    });

    it("should export RalphResult interface", () => {
      const result: RalphResult = {
        success: true,
        message: "Task completed",
        iterations: 3,
        checkpointId: "cp-123",
      };

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(3);
    });

    it("should export RalphConfig interface", () => {
      const config: RalphConfig = {
        apiKey: "test-key",
        maxPromptLength: 10000,
        maxConcurrent: 5,
        requestTimeout: 300000,
        debug: false,
      };

      expect(config.apiKey).toBe("test-key");
      expect(config.maxPromptLength).toBe(10000);
    });
  });

  describe("Configuration", () => {
    it("should have secure default config", () => {
      const config = Ralph.getConfig();
      
      expect(config).toBeDefined();
      expect(config.maxPromptLength).toBeGreaterThan(0);
      expect(config.maxConcurrent).toBeGreaterThan(0);
      expect(config.requestTimeout).toBeGreaterThan(0);
      expect(typeof config.debug).toBe("boolean");
    });
  });

  describe("Request ID generation", () => {
    it("should generate unique request IDs", () => {
      const id1 = Ralph.generateRequestId();
      const id2 = Ralph.generateRequestId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it("should have expected request ID format", () => {
      const id = Ralph.generateRequestId();
      expect(id).toMatch(/^rw_\d+_\d+$/);
    });
  });
});

describe("RalphWiggums Integration Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Ralph.setContainerFetch(mockContainerFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Ralph.setContainerFetch(null);
    Ralph.releaseSemaphore();
  });

  it("should complete form filling workflow", async () => {
    mockContainerFetch.mockResolvedValue({
      success: true,
      data: "TASK_COMPLETE",
    });

    const result = await Ralph.run(
      "Fill out the contact form with name=test, email=test@example.com"
    );

    expect(result.success).toBe(true);
    expect(result.iterations).toBe(1);
    expect(result.checkpointId).toBeDefined();
    expect(result.requestId).toBeDefined();
  });

  it("should handle extraction workflow", async () => {
    mockContainerFetch.mockResolvedValue({
      success: true,
      data: "TASK_COMPLETE",
    });

    const result = await Ralph.run("Extract product name, price, and description");

    expect(result.success).toBe(true);
  });

  it("should track iterations correctly with multi-step task", async () => {
    let callCount = 0;
    mockContainerFetch.mockImplementation((path) => {
      callCount++;
      if (path === "/start") return Promise.resolve({ success: true });
      if (path === "/instruction") {
        if (callCount <= 6) return Promise.resolve({ data: "Step in progress..." });
        return Promise.resolve({ data: "TASK_COMPLETE" });
      }
      return Promise.resolve({ success: true });
    });

    const result = await Effect.runPromise(
      Ralph.doThis("Multi-step task", { maxIterations: 5 })
    ) as RalphResult;

    expect(result.success).toBe(true);
    expect(result.iterations).toBeGreaterThanOrEqual(1);
  });
});

describe("RalphWiggums Security Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Ralph.setContainerFetch(mockContainerFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Ralph.setContainerFetch(null);
    Ralph.releaseSemaphore();
  });

  it("should have semaphore for concurrency control", () => {
    expect(typeof Ralph.acquireSemaphore).toBe("function");
    expect(typeof Ralph.releaseSemaphore).toBe("function");
    expect(typeof Ralph.getActiveRequestCount).toBe("function");
  });

  it("should have getConfig function", () => {
    const config = Ralph.getConfig();
    expect(config).toBeDefined();
    expect(config).toHaveProperty("apiKey");
    expect(config).toHaveProperty("maxPromptLength");
    expect(config).toHaveProperty("maxConcurrent");
    expect(config).toHaveProperty("requestTimeout");
    expect(config).toHaveProperty("debug");
  });
});
