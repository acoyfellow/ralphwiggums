async function createDirectPlaywrightBrowser(apiKey: string, requestId: string) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  return {
    page,
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