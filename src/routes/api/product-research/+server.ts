import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

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

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as ProductResearchRequest;
    const { url, instructions } = body;

    if (!url) {
      return json({ success: false, message: 'URL is required' }, { status: 400 });
    }

    // In dev: call worker at localhost:1337
    // In prod: use service binding (platform.env.WORKER)
    const dev = process.env.NODE_ENV === 'development';
    const workerUrl = dev ? 'http://localhost:1337' : 'http://worker';

    const response = await fetch(`${workerUrl}/do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Extract from ${url}: ${instructions || 'name, price, description'}`
      })
    });

    const result = await response.json() as WorkerResponse;

    if (!response.ok) {
      return json({ success: false, message: result.message || result.error || 'Request failed' }, { status: response.status });
    }

    return json(result);
  } catch (error) {
    console.error('Product research error:', error);
    return json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
};
