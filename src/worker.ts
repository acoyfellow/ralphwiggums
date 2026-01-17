import { Hono } from "hono";
import { doThis } from "./index.js";
import { setContainerBinding } from "./index.js";
import { RalphContainer } from "../container/container.js";
import { OrchestratorDO } from "./orchestrator/orchestrator-do.js";

const app = new Hono();

// Export Durable Object classes that this worker binds to
export { RalphContainer, OrchestratorDO };

// Export createHandlers function for API usage
export function createHandlers() {
  return app;
}

app.post("/do", async (c) => {
  try {
    const body = await c.req.json();
    const { prompt, maxIterations = 5, timeout = 60000, schema } = body;

    if (!prompt) {
      return c.json({ success: false, message: "Prompt is required" }, 400);
    }

    const parsedSchema = schema ? JSON.parse(schema) : undefined;
    const result = await doThis(prompt, { schema: parsedSchema, maxIterations, timeout });

    return c.json(result);
  } catch (error) {
    console.error("[WORKER] /do error:", error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
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

    // Set up container binding for production
    if (env.CONTAINER) {
      console.log('[WORKER] Setting container binding');
      setContainerBinding(env.CONTAINER);
    } else {
      console.log('[WORKER] No container binding found');
    }

    // Set up Zen API key if available
    if (env.ZEN_API_KEY) {
      console.log('[WORKER] Setting Zen API key');
      // We need to import and call setZenApiKey
      const { setZenApiKey } = await import("./index.js");
      setZenApiKey(env.ZEN_API_KEY);
    }

    // Delegate to Hono handlers
    return app.fetch(request);
  }
};