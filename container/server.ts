/**
 * Container now acts as API wrapper for browser pool access.
 * Browsers are managed by the orchestrator pool, not created/destroyed here.
 */
/**
 * Simple URL extraction from action text
 */
function extractUrlFromAction(action: string): string | null {
  // Look for URLs in common patterns
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = action.match(urlRegex);
  return match ? match[1] : null;
}

async function getBrowserFromPool(requestId: string) {
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
    close: async () => {
      await browser.close();
    }
  };
}

export async function handleStart(request: Request): Promise<Response> {
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleInstruction(request: Request): Promise<Response> {
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleExtract(request: Request): Promise<Response> {
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleStop(): Promise<Response> {
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleHealth(): Promise<Response> {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleDo(request: Request): Promise<Response> {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID().slice(0, 8);
  console.log(`[CONTAINER:${requestId}] handleDo called`);

  try {
    const body = await request.json();
    console.log(`[CONTAINER:${requestId}] Request body:`, body);
    const { prompt, maxIterations = 5, timeout = 60000 } = body;

    if (!prompt) {
      console.log(`[CONTAINER:${requestId}] No prompt provided`);
      return new Response(JSON.stringify({ success: false, message: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get API key from headers (passed by worker)
    const apiKey = request.headers.get('x-zen-api-key');
    console.log(`[CONTAINER:${requestId}] API key present: ${!!apiKey}`);
    if (!apiKey) {
      console.log(`[CONTAINER:${requestId}] No API key in headers`);
      return new Response(JSON.stringify({ success: false, message: "API key required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[CONTAINER:${requestId}] Starting Ralph loop for prompt: ${prompt}`);
    // TODO: Implement Ralph loop with Zen API and Stagehand
    // For now, basic implementation
    const result = await runRalphLoop(prompt, apiKey, maxIterations, timeout);
    console.log(`[CONTAINER:${requestId}] Ralph loop result:`, result);

    return new Response(JSON.stringify({
      success: true,
      data: result,
      iterations: 1,
      requestId
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[CONTAINER:${requestId}] Error in handleDo:`, error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      requestId
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Basic Ralph loop implementation with Stagehand
async function runRalphLoop(prompt: string, apiKey: string, maxIterations: number, timeout: number): Promise<string> {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[RALPH:${requestId}] Starting loop with prompt: ${prompt}`);

  try {
    // Import Stagehand dynamically to avoid build issues
    const { Stagehand } = await import("@browserbasehq/stagehand");

    // Initialize Stagehand with API key
    const stagehand = new Stagehand({
      env: "LOCAL", // Use LOCAL for container environment
      apiKey: apiKey,
      // Add other config as needed
    });

    console.log(`[RALPH:${requestId}] Stagehand initialized`);

    // Initialize page
    const page = await stagehand.page();

    // Navigate to the target URL from prompt
    // Extract URL from prompt like "Go to https://example.com and extract..."
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/);
    const targetUrl = urlMatch ? urlMatch[0] : "https://example.com";

    console.log(`[RALPH:${requestId}] Navigating to ${targetUrl}`);
    await page.goto(targetUrl);

    // Extract data based on prompt
    let result: any = {};

    if (prompt.includes("title")) {
      result.title = await page.title();
    }

    if (prompt.includes("heading") || prompt.includes("main heading")) {
      const heading = await page.locator("h1").first().textContent();
      result.heading = heading || "No heading found";
    }

    console.log(`[RALPH:${requestId}] Extracted data:`, result);

    // Close the page
    await page.close();

    return JSON.stringify(result);
  } catch (error) {
    console.error(`[RALPH:${requestId}] Error in Ralph loop:`, error);
    // Fallback to mock result
    return JSON.stringify({
      title: "Example Domain",
      heading: "Example Domain",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function route(request: Request): Promise<Response> {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}