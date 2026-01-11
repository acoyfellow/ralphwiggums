/**
 * RalphWiggums Container for Cloudflare Containers
 * Routes requests to the container server implementation.
 */

import { Container } from "@cloudflare/containers";
import { handleStart, handleInstruction, handleExtract, handleStop, handleHealth, handleDo, route } from "./server.ts";

export class RalphContainer extends Container {
  defaultPort = 8081;

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method ?? "GET";

    // Route to handlers
    if (pathname === "/do" && method === "POST") {
      return handleDo(request);
    }

    if (pathname === "/start" && method === "POST") {
      return handleStart(request as any);
    }

    if (pathname === "/instruction" && method === "POST") {
      return handleInstruction(request as any);
    }

    if (pathname === "/extract" && method === "POST") {
      return handleExtract(request as any);
    }

    if (pathname === "/stop" && method === "POST") {
      return handleStop();
    }

    if (pathname === "/health" && method === "GET") {
      return handleHealth();
    }

    return route(request as any);
  }
}