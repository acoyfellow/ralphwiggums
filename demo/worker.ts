import { run, setContainerBinding, setContainerUrl } from "../src/index.js";
import { RalphContainer } from "../container/container.js";

export { RalphContainer };

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (env.CONTAINER_URL && typeof env.CONTAINER_URL === "string") {
      setContainerUrl(env.CONTAINER_URL);
    } else if (env.CONTAINER) {
      setContainerBinding(env.CONTAINER);
    } else {
      setContainerUrl("http://localhost:8081");
    }

    if (pathname.startsWith("/api/")) {
      return handleApi(pathname, request, env);
    }

    if (env.ASSETS) {
      return (env.ASSETS as any).fetch(request);
    }

    return new Response("Assets not configured", { status: 500 });
  },
};

async function handleApi(pathname: string, request: Request, env: Record<string, unknown>): Promise<Response> {
  switch (pathname) {
    case "/api/contact-form":
      return handleContactForm(request, env);
    case "/api/product-research":
      return handleProductResearch(request, env);
    default:
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
  }
}

async function handleContactForm(request: Request, env: Record<string, unknown>): Promise<Response> {
  const body = await request.json() as { url?: string; data?: Record<string, string> };

  try {
    const result = await run(
      `Go to ${body.url}, fill out the form with: ${Object.entries(body.data ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")
      }, then click submit`
    );

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleProductResearch(request: Request, env: Record<string, unknown>): Promise<Response> {
  const body = await request.json() as { url?: string; instructions?: string };

  try {
    const result = await run(
      `Extract from ${body.url}: ${body.instructions ?? "name, price, description"}`
    );

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
