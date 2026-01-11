/**
 * ralphwiggums API Worker Entrypoint
 *
 * This worker handles:
 * - POST /do - Execute browser automation tasks
 * - POST /resume/:checkpointId - Resume from checkpoint
 * - GET /status/:taskId - Get task status
 * - GET /health - Health check
 */

import { createHandlers, setContainerBinding, setContainerUrl } from "./index.js";
import { CheckpointDO } from "./checkpoint-do.js";
import { OrchestratorDO } from "./orchestrator/orchestrator-do.js";

export { CheckpointDO };
export { RalphContainer } from "../container/container.js";
export { OrchestratorDO };

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    if (env.CONTAINER_URL && typeof env.CONTAINER_URL === "string") {
      setContainerUrl(env.CONTAINER_URL);
    } else if (env.CONTAINER) {
      setContainerBinding(env.CONTAINER);
    } else {
      setContainerUrl("http://localhost:8081");
    }

    const app = createHandlers();
    return app.fetch(request, env as any);
  },
};
