import { Hono } from "hono";
import { RalphContainer } from "../container/server.js";
import { OrchestratorDO } from "./orchestrator/orchestrator-do.js";

const app = new Hono();

// Export Durable Object classes that this worker binds to
export { RalphContainer, OrchestratorDO };

// Export createHandlers function for API usage
export function createHandlers() {
  return app;
}

app.post("/do", async (c) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[WORKER:${requestId}] /do request received`);

  try {
    const body = await c.req.json();
    const { prompt, maxIterations = 5, timeout = 60000, schema } = body;

    if (!prompt) {
      console.log(`[WORKER:${requestId}] Missing prompt`);
      return c.json({ success: false, message: "Prompt is required" }, 400);
    }

    console.log(`[WORKER:${requestId}] Prompt: ${prompt.substring(0, 50)}...`);
    console.log(`[WORKER:${requestId}] maxIterations: ${maxIterations}`);

    const parsedSchema = schema ? JSON.parse(schema) : undefined;

    // Call the container directly via Container binding
    const container = (c.env as any).CONTAINER;
    console.log(`[WORKER:${requestId}] Container binding:`, container ? 'available' : 'NOT AVAILABLE');

    if (!container) {
      const availableBindings = Object.keys(c.env || {});
      console.error(`[WORKER:${requestId}] Container binding not available`);
      console.error(`[WORKER:${requestId}] Available bindings:`, availableBindings);
      throw new Error(`Container binding not available. Available bindings: ${availableBindings.join(', ')}`);
    }

    console.log(`[WORKER:${requestId}] Calling container...`);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
    };
    
    // Pass Zen API key to container if available
    const zenApiKey = (c.env as any)?.ZEN_API_KEY as string | undefined;
    if (zenApiKey) {
      headers["X-Zen-Api-Key"] = zenApiKey;
      console.log(`[WORKER:${requestId}] Passing Zen API key to container`);
    } else {
      console.warn(`[WORKER:${requestId}] No Zen API key available for container`);
    }
    
    const containerResponse = await container.fetch("http://container/do", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, maxIterations, timeout, schema: parsedSchema })
    });

    console.log(`[WORKER:${requestId}] Container response: ${containerResponse.status}`);

    const result = await containerResponse.json();
    console.log(`[WORKER:${requestId}] Container result: success=${result.success}`);

    return c.json(result);
  } catch (error) {
    console.error(`[WORKER:${requestId}] /do error:`, error);
    console.error(`[WORKER:${requestId}] Error type:`, typeof error);
    console.error(`[WORKER:${requestId}] Error keys:`, error ? Object.keys(error) : 'none');

    // Return detailed error for debugging
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      errorType: typeof error,
      requestId
    }, 500);
  }
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    activeRequests: 0,
    queueLength: 0
  });
});

app.get("/debug", (c) => {
  return c.json({
    message: "Debug endpoint - check worker logs for more info",
    timestamp: new Date().toISOString()
  });
});

// Export the Hono app as default export for Cloudflare Workers
export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    // Debug endpoint to check environment
    if (url.pathname === '/debug') {
      return new Response(JSON.stringify({
        hasContainer: !!env.CONTAINER,
        containerType: typeof env.CONTAINER,
        hasZenApiKey: !!env.ZEN_API_KEY,
        hasOrchestrator: !!env.ORCHESTRATOR,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Container binding is handled automatically by Cloudflare Containers

    // Set up Zen API key if available
    if (env.ZEN_API_KEY) {
      console.log('[WORKER] Setting Zen API key');
      try {
        // Import setZenApiKey from container-client directly
        const { setZenApiKey } = await import("./container-client.js");
        if (typeof setZenApiKey === 'function') {
          setZenApiKey(env.ZEN_API_KEY);
          console.log('[WORKER] Zen API key set successfully');
        } else {
          console.warn('[WORKER] setZenApiKey is not a function, skipping');
        }
      } catch (importError) {
        console.error('[WORKER] Failed to import setZenApiKey:', importError);
        // Continue anyway - container might handle API key via headers
      }
    }

    // Delegate to Hono handlers with environment context
    return app.fetch(request, env);
  }
};