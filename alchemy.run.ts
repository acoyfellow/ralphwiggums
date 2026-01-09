/// <reference types="@types/node" />

/**
 * Alchemy Infrastructure Definition for ralphwiggums
 *
 * Manages:
 * - ralphwiggums-demo: SvelteKit app with Worker binding for container calls
 */

/// <reference types="@types/node" />

/**
 * Alchemy Infrastructure Definition for ralphwiggums
 *
 * Manages:
 * - ralphwiggums-api: Worker with container bindings
 * - ralphwiggums-demo: SvelteKit app with service binding to worker
 */

import alchemy from "alchemy";
import { SvelteKit, Worker, Container } from "alchemy/cloudflare";

import { CloudflareStateStore } from "alchemy/state";

const app = await alchemy("ralphwiggums", {
  password: process.env.ALCHEMY_PASSWORD || "abc123",
  stateStore: undefined, // Temporarily disable state store to bypass crypto issues
});

// Container for browser automation
// Alchemy needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in environment
// for container registry authentication
const browserContainer = await Container("ralph-container", {
  className: "RalphContainer",
  adopt: true,
  build: {
    context: import.meta.dirname,
    dockerfile: "Dockerfile",
    platform: "linux/amd64",
  },
});

// Worker that handles extraction requests
// Note: Rate limiting currently uses in-memory Map (see src/index.ts)
// KV namespace can be added later when needed for distributed rate limiting
const worker = await Worker("ralphwiggums-api", {
  domains: ["ralphwiggums-api.coey.dev"],
  entrypoint: "./src/worker.ts",
  adopt: true,
  bindings: {
    CONTAINER: browserContainer,
    RALPH_API_KEY: alchemy.secret(process.env.RALPH_API_KEY ?? ""),
    CONTAINER_URL: process.env.CONTAINER_URL ?? "http://localhost:8081",
  },
  url: false,
  compatibilityFlags: ["nodejs_compat"],
});

// SvelteKit demo app
export const DEMO = await SvelteKit("ralphwiggums-demo", {
  domains: ["ralphwiggums.coey.dev"],
  bindings: {
    WORKER: worker,
    CONTAINER_URL: process.env.CONTAINER_URL ?? "http://localhost:8081",
  },
  url: true,
  adopt: true,
});

console.log({ url: DEMO.url });

await app.finalize();
