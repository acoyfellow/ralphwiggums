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
import { SvelteKit, Worker, Container, KVNamespace } from "alchemy/cloudflare";

const app = await alchemy("ralphwiggums", {
  password: process.env.ALCHEMY_PASSWORD || "abc123"
});

// KV for rate limiting
const rateLimitKV = await KVNamespace("rate-limit", {
  title: "ralphwiggums-rate-limit",
  adopt: true,
});

// Container for browser automation
const browserContainer = await Container("ralph-container", {
  className: "RalphContainer",
  adopt: true,
  build: {
    context: import.meta.dirname,
    dockerfile: "Dockerfile",
    platform: "linux/amd64",
  },
  envVars: {
    ANTHROPIC_API_KEY: alchemy.secret(process.env.ANTHROPIC_API_KEY ?? ""),
    OPENAI_API_KEY: alchemy.secret(process.env.OPENAI_API_KEY ?? ""),
  },
});

// Worker that handles extraction requests
const worker = await Worker("ralphwiggums-api", {
  entrypoint: "./src/worker.ts",
  adopt: true,
  bindings: {
    RATE_LIMIT_KV: rateLimitKV,
    CONTAINER: browserContainer,
    RALPH_API_KEY: alchemy.secret(process.env.RALPH_API_KEY ?? ""),
    CONTAINER_URL: process.env.CONTAINER_URL ?? "http://localhost:8081",
  },
  url: false,
  compatibilityFlags: ["nodejs_compat"],
});

// SvelteKit demo app
export const DEMO = await SvelteKit("ralphwiggums-demo", {
  bindings: {
    WORKER: worker,
    CONTAINER_URL: process.env.CONTAINER_URL ?? "http://localhost:8081",
  },
  url: true,
  adopt: true,
});

console.log({ url: DEMO.url });

await app.finalize();
