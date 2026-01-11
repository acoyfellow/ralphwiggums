import { query, getRequestEvent } from '$app/server';
import { dev } from '$app/environment';
// Helper function to call the container via worker
// In development: HTTP calls to localhost:8081 (local container)
// In production: Service binding (no network latency)
async function callContainer(platform, endpoint, options = {}) {
    if (dev) {
        // Development: HTTP call to local container
        const containerUrl = process.env.CONTAINER_URL || 'http://localhost:8081';
        return fetch(`${containerUrl}${endpoint}`, options);
    }
    // Production: Service binding to the worker, which calls the container
    return platform.env.WORKER.fetch(new Request(`http://worker${endpoint}`, options));
}
async function callContainerJSON(platform, endpoint, options) {
    try {
        const response = await callContainer(platform, endpoint, options);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Service error');
            throw new Error(`Service error (${response.status}): ${errorText}`);
        }
        return response.json();
    }
    catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('Container temporarily unavailable. Please try again.');
        }
        throw error;
    }
}
// This file can be used for future query functions if needed
// Currently unused - all API calls are handled directly in route handlers
//# sourceMappingURL=data.remote.js.map