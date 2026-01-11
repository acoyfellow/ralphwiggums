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

export async function route(request: Request): Promise<Response> {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}