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

    const dev = process.env.NODE_ENV === 'development';
    const containerUrl = dev ? 'http://localhost:8081' : 'http://worker';

    // Call container /do endpoint directly
    const containerResponse = await fetch(`${containerUrl}/do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Go to ${url} and extract: ${instructions || 'name, price, description'}`,
        maxIterations: 5,
        timeout: 60000
      })
    });

    const result = await containerResponse.json();

    if (!result.success) {
      return json({
        success: false,
        message: result.message || result.error || 'Container automation failed'
      }, { status: containerResponse.status });
    }

    return json({
      success: true,
      data: result.data,
      iterations: result.iterations || 0,
      message: 'Task completed successfully'
    });

  } catch (error) {
    console.error('Product research error:', error);
    return json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
