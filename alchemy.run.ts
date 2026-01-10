/// <reference types="@types/node" />

import alchemy from "alchemy";
import { SvelteKit, Worker, Container } from "alchemy/cloudflare";
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
  adopt: false,
  build: {
    context: import.meta.dirname,
    dockerfile: "Dockerfile",
    platform: "linux/amd64",
  },
});

const worker = await Worker(`${project}-api`, {
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

export const DEMO = await SvelteKit(`${project}-demo`, {
  domains: ["ralphwiggums.coey.dev"],
  bindings: {
    WORKER: worker,
    CONTAINER_URL: process.env.CONTAINER_URL ?? "http://localhost:8081",
  },
  url: true,
  adopt: true,
});

console.info({ url: DEMO.url });

await app.finalize();
