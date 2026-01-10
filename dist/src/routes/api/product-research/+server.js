import { json } from '@sveltejs/kit';
export const POST = async ({ request }) => {
    try {
        const body = await request.json();
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
    }
    catch (error) {
        console.error('Product research error:', error);
        return json({
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};
//# sourceMappingURL=+server.js.map