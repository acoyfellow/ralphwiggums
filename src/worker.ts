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
    console.log(`[WORKER] ${request.method} ${request.url}`);

    if (env.CONTAINER_URL && typeof env.CONTAINER_URL === "string") {
      setContainerUrl(env.CONTAINER_URL);
    } else if (env.CONTAINER) {
      setContainerBinding(env.CONTAINER);
      console.log('[WORKER] Using container binding');
    } else {
      setContainerUrl("http://localhost:8081");
      console.log('[WORKER] Using localhost container');
    }

    if (env.ZEN_API_KEY && typeof env.ZEN_API_KEY === "string") {
      setZenApiKey(env.ZEN_API_KEY);
      console.log('[WORKER] Zen API key configured');
    }

    const app = createHandlers();
    try {
      const response = await app.fetch(request, env as any);
      console.log(`[WORKER] Response: ${response.status}`);
      return response;
    } catch (error) {
      console.error('[WORKER] Error:', error);
      throw error;
    }
  },
};
