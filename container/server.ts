import { createServer as createHttpServer } from 'http';
import type { Server } from 'http';

export class RalphContainer {
  async handleSession(session: any) {
    // Cloudflare Container interface
    return {
      fetch: async (request: Request) => {
        return this.handleRequest(request);
      }
    };
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/do" && request.method === "POST") {
      return this.handleDo(request);
    }

    if (pathname === "/health" && request.method === "GET") {
      return this.handleHealth();
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleDo(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { prompt, maxIterations = 5, timeout = 60000 } = body;

      if (!prompt) {
        return Response.json({ success: false, message: "Prompt is required" }, { status: 400 });
      }

      const requestId = crypto.randomUUID().slice(0, 8);
      console.log(`[CONTAINER:${requestId}] Processing: ${prompt}`);

      // Get browser and process request
      const browser = await this.getBrowserFromPool(requestId);
      const result = await this.runRalphLoop(prompt, browser, maxIterations, timeout);

      // Cleanup
      await browser.browser.close();

      return Response.json({
        success: result.success,
        message: result.message,
        data: result.data,
        iterations: result.iterations,
        requestId
      });
    } catch (error) {
      console.error("[CONTAINER] Error:", error);
      return Response.json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      }, { status: 500 });
    }
  }

  private async handleHealth(): Promise<Response> {
    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
  }

  private async getBrowserFromPool(requestId: string) {
    // TODO: Integrate with orchestrator pool to get browser instance
    // For now, create browser per request (will be replaced with pool integration)
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    return {
      page,
      browser,
      extract: async (instruction: string) => {
        // Enhanced text extraction with title and content
        const title = await page.title();
        const text = await page.locator('body').textContent();
        const extraction = `${title}\n\n${text?.substring(0, 1000) || "No content found"}`;
        return { extraction };
      },
      act: async (action: string) => {
        // Enhanced navigation support
        if (action.toLowerCase().includes("navigate") || action.toLowerCase().includes("go to")) {
          const url = extractUrlFromAction(action);
          if (url) {
            await page.goto(url);
            return { success: true, message: `Navigated to ${url}` };
          }
        }
        return { success: false, message: "Action not supported" };
      },
    };
  }

  private async runRalphLoop(prompt: string, browser: any, maxIterations: number, timeout: number) {
    try {
      // Extract URL from prompt if present
      const url = extractUrlFromAction(prompt);
      
      // Navigate to URL if found
      if (url) {
        await browser.page.goto(url, { waitUntil: 'networkidle' });
      }
      
      // Extract data from page
      const result = await browser.extract(prompt);
      return {
        success: true,
        message: "Extraction completed",
        data: result.extraction,
        iterations: 1
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        data: null,
        iterations: 1
      };
    }
  }
}

function extractUrlFromAction(action: string): string | null {
  // Extract URL from action text like "go to https://example.com"
  const urlMatch = action.match(/(https?:\/\/[^\s]+)/i);
  return urlMatch ? urlMatch[1] : null;
}

// ============================================================================
// HTTP Server for Local Development
// ============================================================================

export function createServer(container?: RalphContainer): Server {
  const ralphContainer = container || new RalphContainer();
  
  return createHttpServer(async (req, res) => {
    // Convert Node.js request to Web API Request
    const url = `http://${req.headers.host}${req.url}`;
    const body = req.method !== 'GET' && req.method !== 'HEAD' 
      ? await new Promise<string>((resolve, reject) => {
          let data = '';
          req.on('data', chunk => data += chunk);
          req.on('end', () => resolve(data));
          req.on('error', reject);
        })
      : undefined;

    const request = new Request(url, {
      method: req.method || 'GET',
      headers: req.headers as HeadersInit,
      body: body || undefined,
    });

    try {
      const response = await ralphContainer.handleRequest(request);
      const responseBody = await response.text();
      
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(responseBody);
    } catch (error) {
      console.error('[CONTAINER SERVER] Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function createError(message: string, status = 500): Response {
  return Response.json({ success: false, error: message }, { status });
}

// ============================================================================
// Test Helper Functions
// ============================================================================

export function resetBrowser() {
  // No-op for now
}

export function setBrowser(browser: any) {
  // No-op for now - browser injection handled via createServer param
}

// ============================================================================
// Server Startup (when run directly)
// ============================================================================

if (import.meta.main) {
  const port = parseInt(process.env.PORT || '8081', 10);
  const server = createServer();
  server.listen(port, () => {
    console.log(`[CONTAINER SERVER] Listening on port ${port}`);
  });
}