import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';

interface ProductResearchRequest {
  url: string;
  instructions?: string;
}

interface WorkerResponse {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

export const POST: RequestHandler = async ({ request, platform }) => {
  try {
    const body = await request.json() as ProductResearchRequest;
    const { url, instructions } = body;

    if (!url) {
      return json({ success: false, message: 'URL is required' }, { status: 400 });
    }

    // Prepare request body
    const requestBody = {
      prompt: `Go to ${url} and extract: ${instructions || 'name, price, description'}`,
      maxIterations: 5,
      timeout: 60000
    };

    let workerResponse: Response;

    // Get API key if set (for worker authentication)
    const apiKey = (platform?.env as any)?.RALPH_API_KEY as string | undefined;

    if (dev) {
      // Development: Direct HTTP call to container (bypasses worker)
      const containerUrl = platform?.env?.CONTAINER_URL || process.env.CONTAINER_URL || 'http://localhost:8081';
      const zenApiKey = (platform?.env as any)?.ZEN_API_KEY as string | undefined || process.env.ZEN_API_KEY;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      // Pass ZEN_API_KEY via header as fallback if container server doesn't have it in env
      if (zenApiKey) {
        headers['X-Zen-Api-Key'] = zenApiKey;
      }
      workerResponse = await fetch(`${containerUrl}/do`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
    } else {
      // Production: Use worker service binding
      // Service bindings don't have .url - use dummy URL, binding intercepts it
      const workerUrl = 'http://worker/do';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['X-Api-Key'] = apiKey;
      }
      // Pass ZEN_API_KEY via header for container authentication
      const zenApiKey = (platform?.env as any)?.ZEN_API_KEY as string | undefined;
      if (zenApiKey) {
        headers['X-Zen-Api-Key'] = zenApiKey;
        console.log('[DEMO] Passing Zen API key to worker');
      } else {
        console.warn('[DEMO] No Zen API key available');
      }
      console.log(`[DEMO] Calling worker at ${workerUrl}`);
      workerResponse = await platform!.env!.WORKER.fetch(workerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      console.log(`[DEMO] Worker response: ${workerResponse.status}`);
    }

    const result = await workerResponse.json();

    if (!result.success) {
      return json({
        success: false,
        message: result.message || result.error || 'Automation failed'
      }, { status: workerResponse.status });
    }

    return json({
      success: true,
      data: result.data,
      iterations: result.iterations || 0,
      message: 'Task completed successfully via orchestrator'
    });

  } catch (error) {
    console.error('Product research error:', error);
    return json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
