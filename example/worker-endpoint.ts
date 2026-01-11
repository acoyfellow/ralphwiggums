/**
 * ralphwiggums Example: Cloudflare Worker Endpoint
 * 
 * Production-ready Worker setup with proper error handling,
 * authentication, and response formatting.
 * 
 * Deploy: bun run deploy
 */

import { run } from "ralphwiggums";
import type { RalphOptions } from "ralphwiggums";

// ============================================================================
// Example 1: Basic Worker Endpoint
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

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
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  },
};

// ============================================================================
// Example 2: Worker with API Key Authentication
// ============================================================================

export async function authenticatedWorker(
  request: Request,
  env: { RALPH_API_KEY?: string }
): Promise<Response> {
  // Check API key
  const apiKey = request.headers.get("X-Api-Key");
  if (env.RALPH_API_KEY && apiKey !== env.RALPH_API_KEY) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { prompt, options } = await request.json() as {
      prompt: string;
      options?: RalphOptions;
    };

    const result = await run(prompt, options || {});

    return Response.json({
      success: result.success,
      data: result.data,
      iterations: result.iterations,
    });
  } catch (error) {
    console.error("Worker error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Example 3: Worker with CORS and Rate Limiting
// ============================================================================

interface RateLimitStore {
  get: (key: string) => Promise<number | null>;
  set: (key: string, value: number, ttl: number) => Promise<void>;
}

export async function productionWorker(
  request: Request,
  env: {
    RALPH_API_KEY?: string;
    RATE_LIMIT?: RateLimitStore;
  }
): Promise<Response> {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
      },
    });
  }

  // Rate limiting (simple example - use KV or Durable Objects in production)
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  if (env.RATE_LIMIT) {
    const count = await env.RATE_LIMIT.get(clientIp) || 0;
    if (count > 60) {
      return Response.json(
        { error: "Rate limit exceeded" },
        { 
          status: 429,
          headers: { "Retry-After": "60" },
        }
      );
    }
    await env.RATE_LIMIT.set(clientIp, count + 1, 60);
  }

  // Authentication
  const apiKey = request.headers.get("X-Api-Key");
  if (env.RALPH_API_KEY && apiKey !== env.RALPH_API_KEY) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { prompt, options } = await request.json() as {
      prompt: string;
      options?: RalphOptions;
    };

    const result = await run(prompt, options || {});

    return Response.json(result, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return Response.json(
      { 
        error: error instanceof Error ? error.message : "Internal server error",
        success: false,
      },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

// ============================================================================
// Example 4: Worker with Multiple Routes
// ============================================================================

export async function multiRouteWorker(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (path === "/health" && request.method === "GET") {
    return Response.json({ status: "healthy" });
  }

  // Main automation endpoint
  if (path === "/do" && request.method === "POST") {
    try {
      const { prompt, options } = await request.json() as {
        prompt: string;
        options?: RalphOptions;
      };

      const result = await run(prompt, options || {});
      return Response.json(result);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  }

  // Status endpoint
  if (path === "/status" && request.method === "GET") {
    return Response.json({
      service: "ralphwiggums",
      version: "0.0.1",
      status: "operational",
    });
  }

  return new Response("Not found", { status: 404 });
}
