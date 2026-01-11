/**
 * ralphwiggums Container Server
 * HTTP server for browser automation inside Cloudflare Containers.
 *
 * API Reference: https://docs.stagehand.dev/v3
 */

import http from "node:http";
import { Stagehand } from "@browserbasehq/stagehand";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";

// ============================================================================
// Types & Constants
// ============================================================================

// Promise tag detection regex (used by orchestrator for completion detection)
const PROMISE_TAG_REGEX = /<promise>(.*?)<\/promise>/gi;

export interface StartRequest {
  viewport?: { width: number; height: number };
  colorScheme?: "light" | "dark";
}

export interface InstructionRequest {
  instruction: string;
}

export interface ExtractRequest {
  instruction: string;
  schema: unknown;
}

export interface DoRequest {
  prompt: string;
  stream?: boolean; // Enable WebSocket streaming
   maxIterations?: number; // DEPRECATED: Orchestrator now controls iterations
}

// ============================================================================
// AI Provider Configuration
// ============================================================================

type AIProvider = "groq" | "zen";

// ============================================================================
// Event Types for WebSocket Streaming
// ============================================================================

export type RalphEvent =
  | { type: "start"; prompt: string; timestamp: number }
  | { type: "iteration"; iteration: number; maxIterations: number; timestamp: number }
  | { type: "action"; action: string; timestamp: number }
  | { type: "log"; level: string; message: string; category?: string; timestamp: number }
  | { type: "extraction"; extraction: string; timestamp: number }
  | { type: "progress"; message: string; timestamp: number }
  | { type: "promise"; promise: string; timestamp: number }
  | { type: "success"; data: string; iterations: number; timestamp: number }
  | { type: "error"; message: string; timestamp: number };

// ============================================================================
// Browser State & Pool Management
// ============================================================================

// Browser instance with metadata for pool management
interface BrowserInstance {
  id: string;
  browser: Stagehand;
  status: 'available' | 'busy' | 'unhealthy';
  createdAt: number;
  lastUsedAt: number;
  taskCount: number;
}

// Global browser pool for persistent browser management
const browserPool = new Map<string, BrowserInstance>();
let nextBrowserId = 1;

// Legacy single browser for backward compatibility
let browser: Stagehand | null = null;
let browserFactory: () => Stagehand = () => {
  const provider = (process.env.AI_PROVIDER?.toLowerCase() as AIProvider) || "groq";

  switch (provider) {
    case "groq": {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("GROQ_API_KEY required when AI_PROVIDER=groq. Get one from https://console.groq.com/keys (free tier available)");
      }
      return new Stagehand({
        env: "LOCAL",
        model: process.env.GROQ_MODEL || "groq-llama-3.3-70b-versatile",
        localBrowserLaunchOptions: {
          headless: true,
          viewport: { width: 1280, height: 720 },
        },
      } as any);
    }

    case "zen":
      default: {
        const apiKey = process.env.ZEN_API_KEY || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error("ZEN_API_KEY required when AI_PROVIDER=zen. " +
            "Get your API key from your OpenCode Zen dashboard.");
        }
        return new Stagehand({
          env: "LOCAL",
          apiKey,
          model: process.env.ZEN_MODEL || "claude-3-5-sonnet-latest",
          localBrowserLaunchOptions: {
            headless: true,
            viewport: { width: 1280, height: 720 },
          },
        } as any);
      }
  }
};

export function setBrowserFactory(factory: () => Stagehand): void {
  browserFactory = factory;
}

export function getBrowser(): Stagehand | null {
  return browser;
}

export function setBrowser(b: Stagehand | null): void {
  browser = b;
}

export function resetBrowser(): void {
  browser = null;
}

// ============================================================================
// Browser Pool Management Functions
// ============================================================================

/**
 * Create a new browser instance in the pool
 */
export async function createBrowserInstance(): Promise<string> {
  const id = `browser_${nextBrowserId++}`;
  const browser = browserFactory();

  // Initialize the browser
  if (browser && typeof (browser as any).init === "function") {
    await (browser as any).init();
  }

  const instance: BrowserInstance = {
    id,
    browser,
    status: 'available',
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    taskCount: 0,
  };

  browserPool.set(id, instance);
  console.log(`Created browser instance ${id}`);
  return id;
}

/**
 * Acquire an available browser from the pool
 */
export function acquireBrowser(): BrowserInstance | null {
  for (const [id, instance] of browserPool) {
    if (instance.status === 'available') {
      instance.status = 'busy';
      instance.lastUsedAt = Date.now();
      instance.taskCount++;
      console.log(`Acquired browser instance ${id}`);
      return instance;
    }
  }
  return null; // No available browsers
}

/**
 * Acquire a specific browser by ID
 */
export function acquireBrowserById(id: string): BrowserInstance | null {
  const instance = browserPool.get(id);
  if (instance && instance.status === 'available') {
    instance.status = 'busy';
    instance.lastUsedAt = Date.now();
    instance.taskCount++;
    console.log(`Acquired browser instance ${id}`);
    return instance;
  }
  return null;
}

/**
 * Release a browser back to the pool
 */
export function releaseBrowser(id: string): void {
  const instance = browserPool.get(id);
  if (instance && instance.status === 'busy') {
    instance.status = 'available';
    instance.lastUsedAt = Date.now();
    console.log(`Released browser instance ${id}`);
  }
}

/**
 * Mark a browser as unhealthy and remove it
 */
export async function removeBrowser(id: string): Promise<void> {
  const instance = browserPool.get(id);
  if (instance) {
    try {
      await instance.browser.close();
    } catch (e) {
      console.error(`Error closing browser ${id}:`, e);
    }
    browserPool.delete(id);
    console.log(`Removed unhealthy browser instance ${id}`);
  }
}

/**
 * Get pool status
 */
export function getPoolStatus() {
  const instances = Array.from(browserPool.values());
  return {
    total: instances.length,
    available: instances.filter(i => i.status === 'available').length,
    busy: instances.filter(i => i.status === 'busy').length,
    unhealthy: instances.filter(i => i.status === 'unhealthy').length,
    instances: instances.map(i => ({
      id: i.id,
      status: i.status,
      taskCount: i.taskCount,
      lastUsedAt: i.lastUsedAt,
    })),
  };
}

/**
 * Health check all browsers in the pool
 */
export async function healthCheckPool(): Promise<void> {
  for (const [id, instance] of browserPool) {
    try {
      // Simple health check - try to get the active page
      const page = instance.browser.context.activePage();
      if (!page) {
        throw new Error('No active page');
      }
      // Could add more sophisticated checks here
    } catch (e) {
      console.warn(`Browser ${id} failed health check:`, e);
      instance.status = 'unhealthy';
    }
  }
}

/**
 * Clean up old/unused browsers
 */
export async function cleanupPool(maxAge: number = 30 * 60 * 1000): Promise<void> {
  const now = Date.now();
  for (const [id, instance] of browserPool) {
    if (instance.status === 'available' && (now - instance.lastUsedAt) > maxAge) {
      console.log(`Cleaning up old browser ${id}`);
      await removeBrowser(id);
    }
  }
}

// ============================================================================
// WebSocket Server for Real-time Activity Streaming
// ============================================================================

let wss: WebSocketServer | null = null;
const wsClients = new Set<WebSocket>();

export function createWebSocketServer(server: http.Server): void {
  wss = new WebSocketServer({ server });
  
  wss.on("connection", (ws) => {
    wsClients.add(ws);
    console.log("[WS] Client connected");
    
    ws.on("close", () => {
      wsClients.delete(ws);
      console.log("[WS] Client disconnected");
    });
    
    ws.on("error", (err) => {
      console.error("[WS] Error:", err);
      wsClients.delete(ws);
    });
  });
}

export function broadcastEvent(event: RalphEvent): void {
  // Emit to SSE subscribers
  emitEvent(event);
  
  // Emit to WebSocket clients
  const message = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ============================================================================
// Helpers (exported for testing)
// ============================================================================

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB limit

export async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let bodySize = 0;
    
    req.on("data", (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve(null);
        return;
      }
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        if (!body) {
          resolve(null);
          return;
        }
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
    
    req.on("error", () => {
      resolve(null);
    });
  });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function createError(message: string, status = 500): Response {
  return json({ success: false, error: message }, status);
}

// ============================================================================
// Viewport Validation
// ============================================================================

const MIN_VIEWPORT = 100;
const MAX_VIEWPORT = 4096;

function validateViewport(viewport: { width?: number; height?: number } | undefined): { width: number; height: number } {
  const width = viewport?.width ?? 1280;
  const height = viewport?.height ?? 720;

  if (!Number.isFinite(width) || width < MIN_VIEWPORT || width > MAX_VIEWPORT) {
    throw new Error(`Invalid viewport width: ${width}. Must be between ${MIN_VIEWPORT} and ${MAX_VIEWPORT}`);
  }
  if (!Number.isFinite(height) || height < MIN_VIEWPORT || height > MAX_VIEWPORT) {
    throw new Error(`Invalid viewport height: ${height}. Must be between ${MIN_VIEWPORT} and ${MAX_VIEWPORT}`);
  }

  return { width, height };
}

// ============================================================================
// Request Handlers (exported for testing)
// ============================================================================

export async function handleStart(req: http.IncomingMessage): Promise<Response> {
  try {
    const body = (await parseBody(req)) as StartRequest | undefined;
    const viewport = validateViewport(body?.viewport);
    const colorScheme = body?.colorScheme ?? "dark";

    browser = browserFactory();
    
    // Call actual init if it's a real Stagehand instance
    if (browser && typeof (browser as any).init === "function") {
      try {
        await (browser as any).init();
      } catch {
        // Ignore init errors for mocked instances
      }
    }

    return json({ success: true, data: { connected: true } });
  } catch (e) {
    console.error("Start error:", e);
    return createError(e instanceof Error ? e.message : "Failed to start browser");
  }
}

export async function handleInstruction(req: http.IncomingMessage): Promise<Response> {
  try {
    const body = (await parseBody(req)) as InstructionRequest | undefined;
    if (!body?.instruction) {
      return createError("instruction is required");
    }

    if (!browser) {
      return createError("Browser not initialized. Call /start first.");
    }

    const result = await browser.act(body.instruction);
    const response = typeof result === "string" ? result : "TASK_COMPLETE";

    return json({ success: true, data: response });
  } catch (e) {
    console.error("Instruction error:", e);
    return createError(e instanceof Error ? e.message : "Instruction failed");
  }
}

export async function handleExtract(req: http.IncomingMessage): Promise<Response> {
  try {
    if (!browser) {
      return createError("Browser not initialized. Call /start first.");
    }

    const body = (await parseBody(req)) as ExtractRequest | undefined;
    if (!body?.instruction) {
      return createError("instruction is required");
    }
    if (!body?.schema) {
      return createError("schema is required");
    }

    const extracted = await browser.extract(
      body.instruction,
      body.schema as z.ZodType
    );
    return json({ success: true, data: extracted });
  } catch (e) {
    console.error("Extract error:", e);
    return createError(e instanceof Error ? e.message : "Extract failed");
  }
}

export async function handleStop(): Promise<Response> {
  if (browser) {
    await browser.close();
    browser = null;
  }
  return json({ success: true, message: "Browser stopped" });
}

// ============================================================================
// Pool Management Handlers
// ============================================================================

export async function handlePoolStatus(): Promise<Response> {
  try {
    const status = getPoolStatus();
    return json({ success: true, data: status });
  } catch (e) {
    return createError(e instanceof Error ? e.message : "Failed to get pool status");
  }
}

export async function handleCreateBrowser(): Promise<Response> {
  try {
    const browserId = await createBrowserInstance();
    return json({ success: true, data: { browserId } });
  } catch (e) {
    return createError(e instanceof Error ? e.message : "Failed to create browser");
  }
}

export async function handleAcquireBrowser(): Promise<Response> {
  try {
    const instance = acquireBrowser();
    if (instance) {
      return json({ success: true, data: { browserId: instance.id } });
    } else {
      return createError("No available browsers in pool", 503);
    }
  } catch (e) {
    return createError(e instanceof Error ? e.message : "Failed to acquire browser");
  }
}

export async function handleReleaseBrowser(id: string): Promise<Response> {
  try {
    releaseBrowser(id);
    return json({ success: true, message: `Browser ${id} released` });
  } catch (e) {
    return createError(e instanceof Error ? e.message : "Failed to release browser");
  }
}

export async function handlePoolHealthCheck(): Promise<Response> {
  try {
    await healthCheckPool();
    const status = getPoolStatus();
    return json({ success: true, data: status });
  } catch (e) {
    return createError(e instanceof Error ? e.message : "Health check failed");
  }
}

export async function handlePoolCleanup(): Promise<Response> {
  try {
    await cleanupPool();
    const status = getPoolStatus();
    return json({ success: true, data: status });
  } catch (e) {
    return createError(e instanceof Error ? e.message : "Cleanup failed");
  }
}

export async function handleHealth(): Promise<Response> {
  return json({
    success: true,
    data: { status: "healthy", browser: browser !== null },
  });
}

// /do endpoint - single API for browser automation (used by demo worker in local dev)
export async function handleDo(req: http.IncomingMessage): Promise<Response> {
  try {
    const body = (await parseBody(req)) as DoRequest | undefined;
    if (!body?.prompt) {
      return createError("prompt is required");
    }

    const prompt = body.prompt;
    const stream = body.stream ?? false;
    const maxIterations = body.maxIterations ?? 3; // Allow orchestrator to control iterations
    const startTime = Date.now();

    // Broadcast start event
    broadcastEvent({ type: "start", prompt, timestamp: startTime });

    // Start browser if not already running
    if (!browser) {
      browser = browserFactory();

      // Call actual init if it's a real Stagehand instance
      if (browser && typeof (browser as any).init === "function") {
        try {
          await (browser as any).init();
        } catch {
          // Ignore init errors for mocked instances
        }
      }
    }

    // Check if this is an extraction request
    const extractionKeywords = ["extract", "get", "find", "what is", "what's", "list", "count", "title", "text", "content", "visible"];
    const isExtractionPrompt = extractionKeywords.some(keyword =>
      prompt.toLowerCase().includes(keyword)
    );

    let responseData: string = "";
    let iterations = 0;
    let lastError: string | null = null;
    let promiseText: string | null = null;

    // Iterative extraction with learning
    while (iterations < maxIterations) {
      iterations++;
      
      broadcastEvent({ type: "iteration", iteration: iterations, maxIterations, timestamp: Date.now() });
      
      if (isExtractionPrompt) {
        let extractionInstruction = prompt;
        const extractMatch = prompt.match(/Extract\s+from\s+(https?:\/\/[^\s:]+)[:\s]+(.+)/i);
        
        if (extractMatch) {
          const [, targetUrl, instruction] = extractMatch;
          broadcastEvent({ type: "action", action: `navigate to ${targetUrl}`, timestamp: Date.now() });
          const page = browser.context.activePage();
          if (page) {
            await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeoutMs: 30000 });
          }
          extractionInstruction = instruction;
        }

        if (iterations > 1 && lastError) {
          const page = browser.context.activePage();
          if (page) {
            await page.mainFrame().evaluate("window.scrollTo(0, document.body.scrollHeight / 2)");
          }
          await new Promise(r => setTimeout(r, 2000));
          broadcastEvent({ type: "progress", message: `Retry ${iterations}: scrolled and waited for lazy content`, timestamp: Date.now() });
        }
        
        broadcastEvent({ type: "action", action: "extract", timestamp: Date.now() });
        
        const extracted = await browser.extract(extractionInstruction, undefined);
        // Stagehand returns { extraction: "text" } - extract the actual text
        if (extracted && typeof extracted === "object") {
          // @ts-ignore - Stagehand returns { extraction: "text" }
          const result = extracted.extraction || extracted.text || extracted.data || JSON.stringify(extracted);

          broadcastEvent({ type: "extraction", extraction: result.substring(0, 200), timestamp: Date.now() });

          // Check for promise tag completion
          PROMISE_TAG_REGEX.lastIndex = 0; // Reset regex for consistent behavior
          const promiseMatch = PROMISE_TAG_REGEX.exec(result);
          if (promiseMatch) {
            promiseText = promiseMatch[1];
            responseData = promiseText; // Return the promise text as the result
            broadcastEvent({ type: "promise", promise: promiseText, timestamp: Date.now() });
            break; // Exit loop immediately on promise detection
          }

          // Check if result indicates failure
          const failureIndicators = [
            "cannot extract",
            "only shows",
            "DOM provided",
            "hasn't loaded",
            "failed to load",
            "doesn't contain",
            "I cannot"
          ];
          const isFailure = failureIndicators.some(indicator => 
            result.toLowerCase().includes(indicator)
          );
          
          if (!isFailure && result.length > 0) {
            responseData = result;
            break;
          }
          
          lastError = result;
          broadcastEvent({ type: "progress", message: `Iteration ${iterations} failed, will retry...`, timestamp: Date.now() });
        } else {
          lastError = String(extracted);
        }
      } else {
        // Use act() for action tasks
        broadcastEvent({ type: "action", action: prompt.substring(0, 50), timestamp: Date.now() });
        const result = await browser.act(prompt);

        let resultText: string;
        if (typeof result === "string") {
          resultText = result;
        } else if (result && typeof result === "object") {
          // Handle ActResult object
          resultText = result.message || JSON.stringify(result);
        } else {
          resultText = String(result);
        }

        // Check for promise tag completion
        PROMISE_TAG_REGEX.lastIndex = 0; // Reset regex for consistent behavior
        const promiseMatch = PROMISE_TAG_REGEX.exec(resultText);
        if (promiseMatch) {
          promiseText = promiseMatch[1];
          responseData = promiseText; // Return the promise text as the result
          broadcastEvent({ type: "promise", promise: promiseText, timestamp: Date.now() });
          break; // Exit loop immediately on promise detection
        }

        if (typeof result === "string" || (result && typeof result === "object")) {
          responseData = resultText;
          break; // Assume success for action tasks
        } else {
          lastError = resultText;
        }
      }
    }
    
    // Stop browser after task
    if (browser) {
      await browser.close();
      browser = null;
    }

    const totalTime = Date.now() - startTime;
    broadcastEvent({ type: "success", data: responseData.substring(0, 200), iterations, timestamp: Date.now() });

    return json({ success: true, data: responseData, iterations, totalTime, promiseCompleted: promiseText !== null });
  } catch (e) {
    console.error("Do error:", e);
    broadcastEvent({ type: "error", message: e instanceof Error ? e.message : "Unknown error", timestamp: Date.now() });
    return createError(e instanceof Error ? e.message : "Task failed");
  }
}

async function handleInstructionWithString(instruction: string): Promise<Response> {
  if (!browser) {
    return createError("Browser not initialized. Call /start first.");
  }

  const result = await browser.act(instruction);
  const response = typeof result === "string" ? result : "TASK_COMPLETE";

  return json({ success: true, data: response });
}

// ============================================================================
// Router
// ============================================================================

export async function route(req: http.IncomingMessage): Promise<Response> {
  const url = new URL(req.url ?? "", `http://localhost`);
  const pathname = url.pathname;
  const method = req.method ?? "GET";

  if (pathname === "/start" && method === "POST") {
    return handleStart(req);
  }

  if (pathname === "/instruction" && method === "POST") {
    return handleInstruction(req);
  }

  if (pathname === "/extract" && method === "POST") {
    return handleExtract(req);
  }

  if (pathname === "/stop" && method === "POST") {
    return handleStop();
  }

  if (pathname === "/health" && method === "GET") {
    return handleHealth();
  }

  if (pathname === "/do" && method === "POST") {
    return handleDo(req);
  }

  // Pool management endpoints
  if (pathname === "/pool/status" && method === "GET") {
    return handlePoolStatus();
  }

  if (pathname === "/pool/create" && method === "POST") {
    return handleCreateBrowser();
  }

  if (pathname === "/pool/acquire" && method === "POST") {
    return handleAcquireBrowser();
  }

  if (pathname.startsWith("/pool/release/") && method === "POST") {
    const id = pathname.replace("/pool/release/", "");
    return handleReleaseBrowser(id);
  }

  if (pathname === "/pool/health-check" && method === "POST") {
    return handlePoolHealthCheck();
  }

  if (pathname === "/pool/cleanup" && method === "POST") {
    return handlePoolCleanup();
  }

  // SSE endpoint for real-time events (works in Cloudflare Workers)
  if (pathname === "/events" && method === "GET") {
    return handleEvents(req);
  }

  return createError(`Not found: ${method} ${pathname}`, 404);
}

// ============================================================================
// SSE Event Streaming (alternative to WebSocket for Cloudflare Workers)
// ============================================================================

const eventSubscribers = new Set<(event: RalphEvent) => void>();

export function subscribeToEvents(callback: (event: RalphEvent) => void): () => void {
  eventSubscribers.add(callback);
  return () => eventSubscribers.delete(callback);
}

function emitEvent(event: RalphEvent): void {
  for (const callback of eventSubscribers) {
    try {
      callback(event);
    } catch (e) {
      console.error("Event callback error:", e);
    }
  }
}

async function handleEvents(req: http.IncomingMessage): Promise<Response> {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`));
      
      // Subscribe to events
      const unsubscribe = subscribeToEvents((event: RalphEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });
      
      // Handle client disconnect
      req.on("close", () => {
        unsubscribe();
      });
      
      req.on("error", () => {
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// ============================================================================
// Server Creation
// ============================================================================

export function createServer(stagehand?: Stagehand): http.Server {
  if (stagehand) {
    setBrowser(stagehand);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const response = await route(req);
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(await response.text());
    } catch (e) {
      console.error("Unhandled error:", e);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Internal server error" }));
    }
  });

  // Attach WebSocket server for real-time activity streaming
  createWebSocketServer(server);

  return server;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8081;
  console.log(`RalphWiggums Container Server starting on port ${PORT}...`);

  const server = createServer();

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    await handleStop();
    server.close(() => process.exit(0));
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await handleStop();
    server.close(() => process.exit(0));
  });
}

// Run if executed directly
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  main();
}
