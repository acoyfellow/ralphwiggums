/**
 * @fileoverview
 * ralphwiggums - Unit Tests
 * Tests for core library functionality with mocked dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Cloudflare dependencies before importing the module
vi.mock("cloudflare:workers", () => ({
  fetch: vi.fn(),
}));
vi.mock("@cloudflare/containers", () => ({
  Container: vi.fn(),
  getContainer: vi.fn(),
  switchPort: vi.fn(),
}));

// Mock the module to test
import type { RalphOptions, RalphResult } from "../../dist/src/index.js";
import { run, ValidationError, MaxIterationsError, TimeoutError, BrowserError, RateLimitError, UnauthorizedError } from "../../dist/src/index.js";
import { setContainerFetch } from "../../dist/src/index.js";

// ============================================================================
// Mock Setup
// ============================================================================

const mockContainerFetch = vi.fn();

// Reset and setup mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  setContainerFetch(null);
});

// ============================================================================
// Test Suites
// ============================================================================

describe("run()", () => {
  it("should call container with correct parameters", async () => {
    mockContainerFetch.mockResolvedValue({
      success: true,
      data: "test result",
      iterations: 1,
      message: "Task completed"
    });

    setContainerFetch(mockContainerFetch);

    const result = await run("Go to example.com and get title");

    expect(mockContainerFetch).toHaveBeenCalledWith("/do", {
      prompt: "Go to example.com and get title",
      maxIterations: 10,
      timeout: 300000
    });

    expect(result).toEqual({
      success: true,
      message: "Task completed",
      data: "test result",
      iterations: 1
    });
  });

  it("should use custom options", async () => {
    mockContainerFetch.mockResolvedValue({
      success: true,
      data: "result",
      iterations: 1,
      message: "Done"
    });

    setContainerFetch(mockContainerFetch);

    const options: RalphOptions = {
      maxIterations: 5,
      timeout: 60000
    };

    await run("Test prompt", options);

    expect(mockContainerFetch).toHaveBeenCalledWith("/do", {
      prompt: "Test prompt",
      maxIterations: 5,
      timeout: 60000
    });
  });

  it("should handle container errors", async () => {
    mockContainerFetch.mockRejectedValue(new Error("Container failed"));

    setContainerFetch(mockContainerFetch);

    await expect(run("Test")).rejects.toThrow("Container failed");
  });

  it("should validate prompt", async () => {
    await expect(run("")).rejects.toThrow(ValidationError);
    await expect(run("   ")).rejects.toThrow(ValidationError);
  });

  it("should validate prompt length", async () => {
    const longPrompt = "a".repeat(10001);
    await expect(run(longPrompt)).rejects.toThrow(ValidationError);
  });

  it("should include requestId in result", async () => {
    mockContainerFetch.mockResolvedValue({
      success: true,
      data: "result",
      iterations: 1,
      message: "Done",
      requestId: "test-123"
    });

    setContainerFetch(mockContainerFetch);

    const result = await run("Test");

    expect(result.requestId).toBe("test-123");
  });
});

describe("Error Classes", () => {
  it("should export all error classes", () => {
    expect(ValidationError).toBeDefined();
    expect(MaxIterationsError).toBeDefined();
    expect(TimeoutError).toBeDefined();
    expect(BrowserError).toBeDefined();
    expect(RateLimitError).toBeDefined();
    expect(UnauthorizedError).toBeDefined();
  });

  it("ValidationError should have correct name", () => {
    const error = new ValidationError("test");
    expect(error.name).toBe("ValidationError");
    expect(error.message).toBe("test");
  });

  it("MaxIterationsError should include maxIterations", () => {
    const error = new MaxIterationsError(5);
    expect(error.name).toBe("MaxIterationsError");
    expect(error.maxIterations).toBe(5);
    expect(error.message).toBe("Task failed after 5 iterations");
  });

  it("TimeoutError should include duration", () => {
    const error = new TimeoutError(30000);
    expect(error.name).toBe("TimeoutError");
    expect(error.duration).toBe(30000);
    expect(error.message).toBe("Task timed out after 30000ms");
  });

  it("BrowserError should include reason", () => {
    const error = new BrowserError("page crashed");
    expect(error.name).toBe("BrowserError");
    expect(error.reason).toBe("page crashed");
    expect(error.message).toBe("Browser error: page crashed");
  });

  it("RateLimitError should include retryAfter", () => {
    const error = new RateLimitError(60);
    expect(error.name).toBe("RateLimitError");
    expect(error.retryAfter).toBe(60);
    expect(error.message).toBe("Rate limited. Retry after 60 seconds");
  });

  it("UnauthorizedError should have default message", () => {
    const error = new UnauthorizedError();
    expect(error.name).toBe("UnauthorizedError");
    expect(error.message).toBe("Missing or invalid API key");
  });
});