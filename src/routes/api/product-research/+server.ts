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

// Production API worker URL - use direct HTTP instead of service binding
const API_WORKER_URL = 'https://ralphwiggums-api.coey.dev';

export const POST: RequestHandler = async ({ request, platform }) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[DEMO:${requestId}] Starting product research request`);

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
    const zenApiKey = (platform?.env as any)?.ZEN_API_KEY as string | undefined;

    if (dev) {
      // Development: Direct HTTP call to container (bypasses worker)
      const containerUrl = platform?.env?.CONTAINER_URL || process.env.CONTAINER_URL || 'http://localhost:8081';
      const devZenApiKey = zenApiKey || process.env.ZEN_API_KEY;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (devZenApiKey) {
        headers['X-Zen-Api-Key'] = devZenApiKey;
      }
      console.log(`[DEMO:${requestId}] Dev mode: calling container at ${containerUrl}`);
      workerResponse = await fetch(`${containerUrl}/do`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
    } else {
      // Production: Try service binding first, fallback to HTTP
      const workerService = (platform?.env as any)?.WORKER;
      
      if (workerService) {
        // Use service binding (more reliable, no network latency)
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        };
        if (apiKey) {
          headers['X-Api-Key'] = apiKey;
        }
        if (zenApiKey) {
          headers['X-Zen-Api-Key'] = zenApiKey;
          console.log(`[DEMO:${requestId}] Production: using service binding with Zen API key`);
        } else {
          console.warn(`[DEMO:${requestId}] Production: service binding available but no Zen API key`);
        }

        console.log(`[DEMO:${requestId}] Production: calling worker via service binding`);
        try {
          // Add timeout to service binding call
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
          
          workerResponse = await workerService.fetch(new Request('http://worker/do', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
          }));
          clearTimeout(timeoutId);
          console.log(`[DEMO:${requestId}] Service binding response: ${workerResponse.status}`);
        } catch (serviceError) {
          console.error(`[DEMO:${requestId}] Service binding failed:`, serviceError);
          // Fallback to HTTP
          console.log(`[DEMO:${requestId}] Falling back to HTTP call`);
          workerResponse = await fetch(`${API_WORKER_URL}/do`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
          });
          console.log(`[DEMO:${requestId}] HTTP fallback response: ${workerResponse.status}`);
        }
      } else {
        // No service binding, use HTTP directly
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        };
        if (apiKey) {
          headers['X-Api-Key'] = apiKey;
        }
        if (zenApiKey) {
          headers['X-Zen-Api-Key'] = zenApiKey;
          console.log(`[DEMO:${requestId}] Production: passing Zen API key via HTTP`);
        } else {
          console.warn(`[DEMO:${requestId}] Production: no Zen API key available`);
        }

        console.log(`[DEMO:${requestId}] Production: calling API worker at ${API_WORKER_URL}/do (no service binding)`);
        // Add timeout to HTTP call
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        
        try {
          workerResponse = await fetch(`${API_WORKER_URL}/do`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          console.log(`[DEMO:${requestId}] API worker response: ${workerResponse.status}`);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw new Error(`HTTP fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
        }
      }
    }

    // Check if response is OK before parsing
    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      console.error(`[DEMO:${requestId}] Worker returned error: ${workerResponse.status} ${workerResponse.statusText}`);
      console.error(`[DEMO:${requestId}] Error response: ${errorText.substring(0, 500)}`);
      return json({
        success: false,
        message: `Worker error: ${workerResponse.status} ${workerResponse.statusText}`
      }, { status: workerResponse.status });
    }

    let result: WorkerResponse;
    try {
      result = await workerResponse.json();
    } catch (parseError) {
      const responseText = await workerResponse.text();
      console.error(`[DEMO:${requestId}] Failed to parse worker response as JSON`);
      console.error(`[DEMO:${requestId}] Response text: ${responseText.substring(0, 500)}`);
      return json({
        success: false,
        message: `Invalid response from worker: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      }, { status: 500 });
    }
    console.log(`[DEMO:${requestId}] Result: success=${result.success}, message=${result.message}`);

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[DEMO:${requestId}] Product research error:`, errorMessage);
    if (errorStack) {
      console.error(`[DEMO:${requestId}] Error stack:`, errorStack);
    }
    return json({
      success: false,
      message: errorMessage || 'An error has occurred'
    }, { status: 500 });
  }
};
