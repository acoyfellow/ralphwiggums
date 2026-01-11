/**
 * ralphwiggums Example: Production Error Handling
 * 
 * Demonstrates how to handle all error types in production code.
 * Shows retry patterns, error recovery, and proper error responses.
 */

import { 
  run,
  type RalphOptions,
  MaxIterationsError,
  TimeoutError,
  BrowserError,
  ValidationError,
  RateLimitError,
} from "ralphwiggums";

// ============================================================================
// Example 1: Basic Error Handling
// ============================================================================

export async function safeRun(prompt: string, options?: RalphOptions) {
  try {
    const result = await run(prompt, options);
    return { success: true, data: result.data };
  } catch (error) {
    if (error instanceof MaxIterationsError) {
      return {
        success: false,
        error: "Task exceeded maximum iterations",
        errorType: "MaxIterationsError",
        maxIterations: error.maxIterations,
      };
    }

    if (error instanceof TimeoutError) {
      return {
        success: false,
        error: "Task timed out",
        errorType: "TimeoutError",
        duration: error.duration,
      };
    }

    if (error instanceof BrowserError) {
      return {
        success: false,
        error: "Browser operation failed",
        errorType: "BrowserError",
        reason: error.reason,
      };
    }

    if (error instanceof ValidationError) {
      return {
        success: false,
        error: "Invalid input",
        errorType: "ValidationError",
        message: error.message,
      };
    }

    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: "Rate limit exceeded",
        errorType: "RateLimitError",
        retryAfter: error.retryAfter,
      };
    }

    return {
      success: false,
      error: "Unknown error",
      errorType: "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Example 2: Retry with Exponential Backoff
// ============================================================================

export async function runWithRetry(
  prompt: string,
  options?: RalphOptions,
  maxRetries: number = 3
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await run(prompt, options);
      return { success: true, data: result.data, attempts: attempt + 1 };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors
      if (error instanceof ValidationError) {
        throw error;
      }

      // Don't retry on rate limit - wait instead
      if (error instanceof RateLimitError) {
        const waitTime = error.retryAfter * 1000;
        console.log(`Rate limited. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Exponential backoff for other errors
      if (attempt < maxRetries - 1) {
        const backoff = Math.pow(2, attempt) * 1000;
        console.log(`Attempt ${attempt + 1} failed. Retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError || new Error("All retries exhausted");
}

// ============================================================================
// Example 3: Error Handling with Checkpoints
// ============================================================================

export async function runWithCheckpoint(
  prompt: string,
  options?: RalphOptions
) {
  try {
    const result = await run(prompt, options);

    // Save checkpoint if provided
    if (result.checkpointId) {
      console.log(`Checkpoint saved: ${result.checkpointId}`);
      // In production, save to database/KV
      // await saveCheckpoint(result.checkpointId, result);
    }

    return result;
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof MaxIterationsError) {
      // Try to resume from checkpoint if available
      const lastCheckpoint = await getLastCheckpoint(); // Your implementation
      
      if (lastCheckpoint) {
        console.log(`Resuming from checkpoint: ${lastCheckpoint}`);
        return run("", {
          ...options,
          resumeFrom: lastCheckpoint,
        });
      }
    }

    throw error;
  }
}

// Placeholder for checkpoint storage
async function getLastCheckpoint(): Promise<string | null> {
  // In production, retrieve from database/KV
  return null;
}

// ============================================================================
// Example 4: Comprehensive Error Handler for API
// ============================================================================

export function handleRalphError(error: unknown): {
  status: number;
  body: { error: string; errorType: string; [key: string]: unknown };
} {
  if (error instanceof MaxIterationsError) {
    return {
      status: 400,
      body: {
        error: "Task exceeded maximum iterations",
        errorType: "MaxIterationsError",
        maxIterations: error.maxIterations,
      },
    };
  }

  if (error instanceof TimeoutError) {
    return {
      status: 504,
      body: {
        error: "Task timed out",
        errorType: "TimeoutError",
        duration: error.duration,
        requestId: error.requestId,
      },
    };
  }

  if (error instanceof BrowserError) {
    return {
      status: 500,
      body: {
        error: "Browser operation failed",
        errorType: "BrowserError",
        reason: error.reason,
        requestId: error.requestId,
      },
    };
  }

  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: {
        error: "Invalid input",
        errorType: "ValidationError",
        message: error.message,
      },
    };
  }

  if (error instanceof RateLimitError) {
    return {
      status: 429,
      body: {
        error: "Rate limit exceeded",
        errorType: "RateLimitError",
        retryAfter: error.retryAfter,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "Internal server error",
      errorType: "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

// ============================================================================
// Example 5: Worker with Error Handling
// ============================================================================

export async function workerWithErrorHandling(
  request: Request
): Promise<Response> {
  try {
    const { prompt, options } = await request.json() as {
      prompt: string;
      options?: RalphOptions;
    };

    if (!prompt) {
      return Response.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    const result = await run(prompt, options);
    return Response.json(result);
  } catch (error) {
    const { status, body } = handleRalphError(error);
    return Response.json(body, { status });
  }
}
