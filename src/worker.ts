/**
 * ralphwiggums API Worker Entrypoint
 *
 * This worker handles:
 * - POST /do - Execute browser automation tasks
 * - POST /resume/:checkpointId - Resume from checkpoint
 * - GET /status/:taskId - Get task status
 * - GET /health - Health check
 */

import { createHandlers, setContainerBinding, setContainerUrl, setZenApiKey } from "./index.js";
import { CheckpointDO } from "./checkpoint-do.js";
import { OrchestratorDO } from "./orchestrator/orchestrator-do.js";

export { CheckpointDO };
export { RalphContainer } from "../container/container.js";
export { OrchestratorDO };

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    const requestId = crypto.randomUUID().slice(0, 8);
    console.log(`[WORKER:${requestId}] ${request.method} ${request.url}`);

    if (env.CONTAINER_URL && typeof env.CONTAINER_URL === "string") {
      setContainerUrl(env.CONTAINER_URL);
      console.log(`[WORKER:${requestId}] Using container URL: ${env.CONTAINER_URL}`);
    } else if (env.CONTAINER) {
      setContainerBinding(env.CONTAINER);
      console.log(`[WORKER:${requestId}] Using container binding`);
    } else {
      setContainerUrl("http://localhost:8081");
      console.log(`[WORKER:${requestId}] Using localhost container`);
    }

    if (env.ZEN_API_KEY && typeof env.ZEN_API_KEY === "string") {
      setZenApiKey(env.ZEN_API_KEY);
      console.log(`[WORKER:${requestId}] Zen API key configured`);
    }

    const app = createHandlers();
    try {
      const response = await app.fetch(request, env as any);
      console.log(`[WORKER:${requestId}] Response: ${response.status}`);
      return response;
    } catch (error) {
      console.error(`[WORKER:${requestId}] Error:`, error);
      throw error;
    }
  },
};
