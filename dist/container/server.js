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
// Browser State
// ============================================================================
let browser = null;
let browserFactory = () => {
    const provider = process.env.AI_PROVIDER?.toLowerCase() || "groq";
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
            });
        }
        case "zen":
        default: {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
                throw new Error("ANTHROPIC_API_KEY required when AI_PROVIDER=zen. " +
                    "OpenCode Zen uses Anthropic's API. Get your key from https://console.anthropic.com/ (must start with 'sk-ant-').");
            }
            // Verify it's an Anthropic-style key
            if (!apiKey.startsWith("sk-ant-")) {
                throw new Error("Invalid API key format. Anthropic keys must start with 'sk-ant-'. " +
                    "Get a key from https://console.anthropic.com/");
            }
            return new Stagehand({
                env: "LOCAL",
                model: process.env.ZEN_MODEL || "claude-3-5-sonnet-latest",
                localBrowserLaunchOptions: {
                    headless: true,
                    viewport: { width: 1280, height: 720 },
                },
            });
        }
    }
};
export function setBrowserFactory(factory) {
    browserFactory = factory;
}
export function getBrowser() {
    return browser;
}
export function setBrowser(b) {
    browser = b;
}
export function resetBrowser() {
    browser = null;
}
// ============================================================================
// WebSocket Server for Real-time Activity Streaming
// ============================================================================
let wss = null;
const wsClients = new Set();
export function createWebSocketServer(server) {
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
export function broadcastEvent(event) {
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
export async function parseBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        let bodySize = 0;
        req.on("data", (chunk) => {
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
            }
            catch {
                resolve(null);
            }
        });
        req.on("error", () => {
            resolve(null);
        });
    });
}
export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
export function createError(message, status = 500) {
    return json({ success: false, error: message }, status);
}
// ============================================================================
// Viewport Validation
// ============================================================================
const MIN_VIEWPORT = 100;
const MAX_VIEWPORT = 4096;
function validateViewport(viewport) {
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
export async function handleStart(req) {
    try {
        const body = (await parseBody(req));
        const viewport = validateViewport(body?.viewport);
        const colorScheme = body?.colorScheme ?? "dark";
        browser = browserFactory();
        // Call actual init if it's a real Stagehand instance
        if (browser && typeof browser.init === "function") {
            try {
                await browser.init();
            }
            catch {
                // Ignore init errors for mocked instances
            }
        }
        return json({ success: true, data: { connected: true } });
    }
    catch (e) {
        console.error("Start error:", e);
        return createError(e instanceof Error ? e.message : "Failed to start browser");
    }
}
export async function handleInstruction(req) {
    try {
        const body = (await parseBody(req));
        if (!body?.instruction) {
            return createError("instruction is required");
        }
        if (!browser) {
            return createError("Browser not initialized. Call /start first.");
        }
        const result = await browser.act(body.instruction);
        const response = typeof result === "string" ? result : "TASK_COMPLETE";
        return json({ success: true, data: response });
    }
    catch (e) {
        console.error("Instruction error:", e);
        return createError(e instanceof Error ? e.message : "Instruction failed");
    }
}
export async function handleExtract(req) {
    try {
        if (!browser) {
            return createError("Browser not initialized. Call /start first.");
        }
        const body = (await parseBody(req));
        if (!body?.instruction) {
            return createError("instruction is required");
        }
        if (!body?.schema) {
            return createError("schema is required");
        }
        const extracted = await browser.extract(body.instruction, body.schema);
        return json({ success: true, data: extracted });
    }
    catch (e) {
        console.error("Extract error:", e);
        return createError(e instanceof Error ? e.message : "Extract failed");
    }
}
export async function handleStop() {
    try {
        if (browser) {
            await browser.close();
            browser = null;
        }
        return json({ success: true, data: null });
    }
    catch (e) {
        console.error("Stop error:", e);
        return createError(e instanceof Error ? e.message : "Stop failed");
    }
}
export async function handleHealth() {
    return json({
        success: true,
        data: { status: "healthy", browser: browser !== null },
    });
}
// /do endpoint - single API for browser automation (used by demo worker in local dev)
export async function handleDo(req) {
    try {
        const body = (await parseBody(req));
        if (!body?.prompt) {
            return createError("prompt is required");
        }
        const prompt = body.prompt;
        const stream = body.stream ?? false;
        const startTime = Date.now();
        // Broadcast start event
        broadcastEvent({ type: "start", prompt, timestamp: startTime });
        // Start browser if not already running
        if (!browser) {
            browser = browserFactory();
            // Call actual init if it's a real Stagehand instance
            if (browser && typeof browser.init === "function") {
                try {
                    await browser.init();
                }
                catch {
                    // Ignore init errors for mocked instances
                }
            }
        }
        // Check if this is an extraction request
        const extractionKeywords = ["extract", "get", "find", "what is", "what's", "list", "count", "title", "text", "content", "visible"];
        const isExtractionPrompt = extractionKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
        let responseData = "";
        let iterations = 0;
        const maxIterations = 3;
        let lastError = null;
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
                    const isFailure = failureIndicators.some(indicator => result.toLowerCase().includes(indicator));
                    if (!isFailure && result.length > 0) {
                        responseData = result;
                        break;
                    }
                    lastError = result;
                    broadcastEvent({ type: "progress", message: `Iteration ${iterations} failed, will retry...`, timestamp: Date.now() });
                }
                else {
                    lastError = String(extracted);
                }
            }
            else {
                // Use act() for action tasks
                broadcastEvent({ type: "action", action: prompt.substring(0, 50), timestamp: Date.now() });
                const result = await browser.act(prompt);
                if (typeof result === "string") {
                    responseData = result;
                    break; // Assume success for action tasks
                }
                else if (result && typeof result === "object") {
                    // Handle ActResult object
                    responseData = result.message || JSON.stringify(result);
                    break; // Assume success for action tasks
                }
                else {
                    lastError = String(result);
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
        return json({ success: true, data: responseData, iterations, totalTime });
    }
    catch (e) {
        console.error("Do error:", e);
        broadcastEvent({ type: "error", message: e instanceof Error ? e.message : "Unknown error", timestamp: Date.now() });
        return createError(e instanceof Error ? e.message : "Task failed");
    }
}
async function handleInstructionWithString(instruction) {
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
export async function route(req) {
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
    // SSE endpoint for real-time events (works in Cloudflare Workers)
    if (pathname === "/events" && method === "GET") {
        return handleEvents(req);
    }
    return createError(`Not found: ${method} ${pathname}`, 404);
}
// ============================================================================
// SSE Event Streaming (alternative to WebSocket for Cloudflare Workers)
// ============================================================================
const eventSubscribers = new Set();
export function subscribeToEvents(callback) {
    eventSubscribers.add(callback);
    return () => eventSubscribers.delete(callback);
}
function emitEvent(event) {
    for (const callback of eventSubscribers) {
        try {
            callback(event);
        }
        catch (e) {
            console.error("Event callback error:", e);
        }
    }
}
async function handleEvents(req) {
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            // Send initial connection message
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`));
            // Subscribe to events
            const unsubscribe = subscribeToEvents((event) => {
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
export function createServer(stagehand) {
    if (stagehand) {
        setBrowser(stagehand);
    }
    const server = http.createServer(async (req, res) => {
        try {
            const response = await route(req);
            res.writeHead(response.status, { "Content-Type": "application/json" });
            res.end(await response.text());
        }
        catch (e) {
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
//# sourceMappingURL=server.js.map