/**
 * ralphwiggums API Worker Entrypoint
 *
 * This worker handles:
 * - POST /do - Execute browser automation tasks
 * - POST /resume/:checkpointId - Resume from checkpoint
 * - GET /status/:taskId - Get task status
 * - GET /health - Health check
 */
import { CheckpointDO } from "./checkpoint-do.js";
export { CheckpointDO };
export { RalphContainer } from "../container/container.js";
declare const _default: {
    fetch(request: Request, env: Record<string, unknown>): Promise<Response>;
};
export default _default;
