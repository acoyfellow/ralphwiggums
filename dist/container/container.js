/**
 * RalphWiggums Container for Cloudflare Containers
 * Routes requests to the container server implementation.
 */
import { Container } from "@cloudflare/containers";
import { handleStart, handleInstruction, handleExtract, handleStop, handleHealth, route } from "./server.js";
export class RalphContainer extends Container {
    defaultPort = 8081;
    envVars = {
        // AI Provider selection (cloudflare or zen)
        AI_PROVIDER: process.env.AI_PROVIDER ?? "zen",
        // Cloudflare AI credentials
        CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN ?? "",
        CLOUDFLARE_MODEL: process.env.CLOUDFLARE_MODEL ?? "",
        // OpenCode Zen credentials
        // Note: Users configure their Anthropic API key in the Zen dashboard,
        // then get a Zen API key to use here
        ANTHROPIC_API_KEY: process.env.ZEN_API_KEY ?? "",
        ZEN_MODEL: process.env.ZEN_MODEL ?? "",
    };
    async onRequest(request) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method ?? "GET";
        // Route to handlers
        if (pathname === "/start" && method === "POST") {
            return handleStart(request);
        }
        if (pathname === "/instruction" && method === "POST") {
            return handleInstruction(request);
        }
        if (pathname === "/extract" && method === "POST") {
            return handleExtract(request);
        }
        if (pathname === "/stop" && method === "POST") {
            return handleStop();
        }
        if (pathname === "/health" && method === "GET") {
            return handleHealth();
        }
        return route(request);
    }
}
//# sourceMappingURL=container.js.map