import { Hono } from "hono";
import { doThis } from "./index.js";

const app = new Hono();

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
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export function createHandlers() {
  return app;
}