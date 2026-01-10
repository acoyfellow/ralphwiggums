/**
 * ralphwiggums Container Server
 * HTTP server for browser automation inside Cloudflare Containers.
 *
 * API Reference: https://docs.stagehand.dev/v3
 */
import http from "node:http";
import { Stagehand } from "@browserbasehq/stagehand";
export interface StartRequest {
    viewport?: {
        width: number;
        height: number;
    };
    colorScheme?: "light" | "dark";
}
export interface InstructionRequest {
    instruction: string;
}
export interface ExtractRequest {
    instruction: string;
    schema: unknown;
}
export interface DoRequest {
    prompt: string;
    stream?: boolean;
    maxIterations?: number;
}
export type RalphEvent = {
    type: "start";
    prompt: string;
    timestamp: number;
} | {
    type: "iteration";
    iteration: number;
    maxIterations: number;
    timestamp: number;
} | {
    type: "action";
    action: string;
    timestamp: number;
} | {
    type: "log";
    level: string;
    message: string;
    category?: string;
    timestamp: number;
} | {
    type: "extraction";
    extraction: string;
    timestamp: number;
} | {
    type: "progress";
    message: string;
    timestamp: number;
} | {
    type: "promise";
    promise: string;
    timestamp: number;
} | {
    type: "success";
    data: string;
    iterations: number;
    timestamp: number;
} | {
    type: "error";
    message: string;
    timestamp: number;
};
interface BrowserInstance {
    id: string;
    browser: Stagehand;
    status: 'available' | 'busy' | 'unhealthy';
    createdAt: number;
    lastUsedAt: number;
    taskCount: number;
}
export declare function setBrowserFactory(factory: () => Stagehand): void;
export declare function getBrowser(): Stagehand | null;
export declare function setBrowser(b: Stagehand | null): void;
export declare function resetBrowser(): void;
/**
 * Create a new browser instance in the pool
 */
export declare function createBrowserInstance(): Promise<string>;
/**
 * Acquire an available browser from the pool
 */
export declare function acquireBrowser(): BrowserInstance | null;
/**
 * Acquire a specific browser by ID
 */
export declare function acquireBrowserById(id: string): BrowserInstance | null;
/**
 * Release a browser back to the pool
 */
export declare function releaseBrowser(id: string): void;
/**
 * Mark a browser as unhealthy and remove it
 */
export declare function removeBrowser(id: string): Promise<void>;
/**
 * Get pool status
 */
export declare function getPoolStatus(): {
    total: number;
    available: number;
    busy: number;
    unhealthy: number;
    instances: {
        id: string;
        status: "available" | "busy" | "unhealthy";
        taskCount: number;
        lastUsedAt: number;
    }[];
};
/**
 * Health check all browsers in the pool
 */
export declare function healthCheckPool(): Promise<void>;
/**
 * Clean up old/unused browsers
 */
export declare function cleanupPool(maxAge?: number): Promise<void>;
export declare function createWebSocketServer(server: http.Server): void;
export declare function broadcastEvent(event: RalphEvent): void;
export declare function parseBody(req: http.IncomingMessage): Promise<unknown>;
export declare function json(data: unknown, status?: number): Response;
export declare function createError(message: string, status?: number): Response;
export declare function handleStart(req: http.IncomingMessage): Promise<Response>;
export declare function handleInstruction(req: http.IncomingMessage): Promise<Response>;
export declare function handleExtract(req: http.IncomingMessage): Promise<Response>;
export declare function handleStop(): Promise<Response>;
export declare function handlePoolStatus(): Promise<Response>;
export declare function handleCreateBrowser(): Promise<Response>;
export declare function handleAcquireBrowser(): Promise<Response>;
export declare function handleReleaseBrowser(id: string): Promise<Response>;
export declare function handlePoolHealthCheck(): Promise<Response>;
export declare function handlePoolCleanup(): Promise<Response>;
export declare function handleHealth(): Promise<Response>;
export declare function handleDo(req: http.IncomingMessage): Promise<Response>;
export declare function route(req: http.IncomingMessage): Promise<Response>;
export declare function subscribeToEvents(callback: (event: RalphEvent) => void): () => void;
export declare function createServer(stagehand?: Stagehand): http.Server;
export {};
