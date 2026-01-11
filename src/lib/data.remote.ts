import { query, getRequestEvent } from '$app/server';
import { dev } from '$app/environment';

interface ExtractionRequest {
  url: string;
  instructions?: string;
}

interface ExtractionResponse {
  success: boolean;
  data?: string;
  message?: string;
  error?: string;
  iterations?: number;
}

// Helper function to call the container via worker
// In development: HTTP calls to localhost:8081 (local container)
// In production: Service binding (no network latency)
async function callContainer(
  platform: App.Platform | undefined,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  if (dev) {
    // Development: HTTP call to local container
    const containerUrl = process.env.CONTAINER_URL || 'http://localhost:8081';
    return fetch(`${containerUrl}${endpoint}`, options);
  }

  // Production: Service binding to the worker, which calls the container
  return platform!.env!.WORKER.fetch(new Request(`http://worker${endpoint}`, options));
}

async function callContainerJSON<T>(
  platform: App.Platform | undefined,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await callContainer(platform, endpoint, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Service error');
      throw new Error(`Service error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Container temporarily unavailable. Please try again.');
    }
    throw error;
  }
}

// This file can be used for future query functions if needed
// Currently unused - all API calls are handled directly in route handlers
