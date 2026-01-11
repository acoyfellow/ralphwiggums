/// <reference types="@types/node" />

import alchemy from "alchemy";
import {
  Worker,
  Container,
  DurableObjectNamespace,
  SvelteKit
} from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";

const project = "ralphwiggums";

const app = await alchemy(project, {
  password: process.env.ALCHEMY_PASSWORD || "abc123",
  stateStore: (scope) => new CloudflareStateStore(scope, {
    scriptName: `${project}-state`,
    stateToken: alchemy.secret(process.env.ALCHEMY_STATE_TOKEN || ""),
    forceUpdate: true,
  }),
});

const browserContainer = await Container(`${project}-container`, {
  className: "RalphContainer",
  adopt: true,  // Adopt existing DO to avoid conflicts on redeploy
  build: {
    context: import.meta.dirname,
    dockerfile: "Dockerfile",
    platform: "linux/amd64",
  },
});

// Create orchestrator Durable Object
const orchestratorDO = await DurableObjectNamespace(`${project}-orchestrator`, {
  className: "OrchestratorDO",
  sqlite: true,
});

// Determine stage from environment (set by CI/CD or default to 'dev')
const stage = process.env.STAGE || "dev";
const isProd = stage === "prod";

// For PR previews, use subdomain pattern: pr-{number}.api.coey.dev and pr-{number}.coey.dev
// For prod (main branch), use fixed domains
const apiDomain = isProd
  ? "ralphwiggums-api.coey.dev"
  : stage.startsWith("pr-")
    ? `${stage}.api.coey.dev`
    : undefined;

const demoDomain = isProd
  ? "ralphwiggums.coey.dev"
  : stage.startsWith("pr-")
    ? `${stage}.coey.dev`
    : undefined;

const worker = await Worker(`${project}-api`, {
  ...(apiDomain ? { domains: [apiDomain] } : {}),
  entrypoint: "./src/worker.ts",
  adopt: true,
  bindings: {
    CONTAINER: browserContainer,
    ORCHESTRATOR: orchestratorDO,
    RALPH_API_KEY: process.env.RALPH_API_KEY ?? "",
    // Only set CONTAINER_URL for non-prod environments
    ...(isProd ? {} : { CONTAINER_URL: process.env.CONTAINER_URL ?? "http://localhost:8081" }),
  },
  // Use preview URL for non-prod stages if no domain is set
  url: !isProd && !apiDomain,
  compatibilityFlags: ["nodejs_compat"],
});

export const DEMO = await SvelteKit(`${project}-demo`, {
  ...(demoDomain ? { domains: [demoDomain] } : {}),
  bindings: {
    WORKER: worker,
    CONTAINER_URL: process.env.CONTAINER_URL ?? "http://localhost:8081",
  },
  // Use preview URL for non-prod stages if no domain is set
  url: !isProd && !demoDomain,
  adopt: true,
});

console.info({ url: DEMO.url });

await app.finalize();
