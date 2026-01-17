import { doThis } from "./container-client.js";
export { createHandlers } from "./worker.js";
export { setContainerBinding, setContainerUrl, setZenApiKey, doThis } from "./container-client.js";
export { setContainerFetch } from "./container-client.js";

// Main API function for direct usage
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

export interface RalphError extends Error {
  name: 'MaxIterationsError' | 'TimeoutError' | 'BrowserError' | 'ValidationError' | 'RateLimitError' | 'UnauthorizedError';
}

// Default values
const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_TIMEOUT = 300000; // 5 minutes

/**
 * Run browser automation task
 * @param prompt Natural language instructions for browser automation
 * @param options Configuration options
 * @returns Promise<RalphResult>
 */
export async function run(prompt: string, options: RalphOptions = {}): Promise<RalphResult> {
  const { maxIterations = DEFAULT_MAX_ITERATIONS, timeout = DEFAULT_TIMEOUT, resumeFrom } = options;

  // Validate input
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new ValidationError('Prompt is required and must be a non-empty string');
  }

  if (prompt.length > 10000) {
    throw new ValidationError('Prompt must be less than 10,000 characters');
  }

  // For now, use direct container call since orchestrator is internal
  // This will be updated when we expose orchestrator HTTP API
  const result = await doThis(prompt, {
    maxIterations,
    timeout
    // resumeFrom not supported in current container implementation
  });

  return {
    success: result.success,
    message: result.message,
    data: result.data,
    iterations: result.iterations || 0,
    checkpointId: result.checkpointId,
    requestId: result.requestId
  };
}

// Error classes
export class ValidationError extends Error {
  name = 'ValidationError' as const;
  constructor(message: string) {
    super(message);
  }
}

export class MaxIterationsError extends Error {
  name = 'MaxIterationsError' as const;
  maxIterations: number;
  constructor(maxIterations: number) {
    super(`Task failed after ${maxIterations} iterations`);
    this.maxIterations = maxIterations;
  }
}

export class TimeoutError extends Error {
  name = 'TimeoutError' as const;
  duration: number;
  constructor(duration: number) {
    super(`Task timed out after ${duration}ms`);
    this.duration = duration;
  }
}

export class BrowserError extends Error {
  name = 'BrowserError' as const;
  reason: string;
  constructor(reason: string) {
    super(`Browser error: ${reason}`);
    this.reason = reason;
  }
}

export class RateLimitError extends Error {
  name = 'RateLimitError' as const;
  retryAfter: number;
  constructor(retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter} seconds`);
    this.retryAfter = retryAfter;
  }
}

export class UnauthorizedError extends Error {
  name = 'UnauthorizedError' as const;
  constructor(message = 'Missing or invalid API key') {
    super(message);
  }
}