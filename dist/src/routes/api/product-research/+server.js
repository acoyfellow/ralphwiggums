import { json } from '@sveltejs/kit';
export const POST = async ({ request, platform }) => {
    try {
        const body = await request.json();
        const { url, instructions } = body;
        if (!url) {
            return json({ success: false, message: 'URL is required' }, { status: 400 });
        }
        // Use worker binding to go through orchestrator instead of direct container call
        const workerUrl = `${platform?.env?.WORKER?.url || 'http://worker'}/do`;
        // Call worker /do endpoint (which will use orchestrator)
        const workerResponse = await platform.env.WORKER.fetch(new Request(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: `Go to ${url} and extract: ${instructions || 'name, price, description'}`,
                maxIterations: 5,
                timeout: 60000
            })
        }));
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