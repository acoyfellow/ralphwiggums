import { json } from '@sveltejs/kit';
export const POST = async ({ request }) => {
    try {
        const body = await request.json();
        const { url, instructions } = body;
        if (!url) {
            return json({ success: false, message: 'URL is required' }, { status: 400 });
        }
        // In dev: call orchestrator at localhost:1337
        // In prod: use service binding (platform.env.WORKER)
        const dev = process.env.NODE_ENV === 'development';
        const workerUrl = dev ? 'http://localhost:1337' : 'http://worker';
        // Queue task with orchestrator
        const queueResponse = await fetch(`${workerUrl}/orchestrator/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                instructions: instructions || 'name, price, description',
                maxIterations: 5
            })
        });
        const queueResult = await queueResponse.json();
        if (!queueResponse.ok) {
            return json({
                success: false,
                message: queueResult.message || queueResult.error || 'Failed to queue task'
            }, { status: queueResponse.status });
        }
        const taskId = queueResult.taskId;
        // Poll for completion (simple implementation - in real app use WebSocket)
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max
        const pollInterval = 1000; // 1 second
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            const statusResponse = await fetch(`${workerUrl}/orchestrator/tasks/${taskId}`);
            const statusResult = await statusResponse.json();
            if (!statusResponse.ok) {
                return json({
                    success: false,
                    message: 'Failed to check task status'
                }, { status: 500 });
            }
            const task = statusResult.task;
            if (!task) {
                attempts++;
                continue;
            }
            if (task.status === 'completed') {
                // Extract data from session state
                const session = task.checkpoints?.session;
                if (session?.completionPromise) {
                    return json({
                        success: true,
                        data: session.completionPromise,
                        taskId,
                        iterations: session.iteration || 0,
                        message: 'Task completed successfully'
                    });
                }
            }
            else if (task.status === 'failed') {
                return json({
                    success: false,
                    message: 'Task failed',
                    taskId,
                    error: task.error || 'Unknown error'
                });
            }
            attempts++;
        }
        // Timeout
        return json({
            success: false,
            message: 'Task timed out',
            taskId
        }, { status: 408 });
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