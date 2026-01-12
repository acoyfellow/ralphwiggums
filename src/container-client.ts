import { Container } from "@cloudflare/containers";

let _containerBinding: any = null;
let _containerFetch: ((path: string, body?: object) => Promise<any>) | null = null;
let _containerUrl: string | null = null;
let _zenApiKey: string | null = null;

export function setContainerBinding(binding: any) {
  _containerBinding = binding;
  _containerFetch = null; // Reset cached fetch
}

export function setContainerUrl(url: string) {
  _containerUrl = url;
  _containerFetch = null; // Reset cached fetch
}

export function setZenApiKey(key: string) {
  _zenApiKey = key;
}

function getContainerUrl(): string | null {
  return _containerUrl;
}

async function containerFetch(
  path: string,
  body?: object,
): Promise<any> {
  const requestId = crypto.randomUUID().slice(0, 8);
  const containerUrl = getContainerUrl();
  if (containerUrl) {
    // Local dev: direct HTTP call
    console.log(`[CONTAINER:${requestId}] Local call to ${containerUrl}${path}`);
    try {
      const response = await fetch(`${containerUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-zen-api-key": _zenApiKey || "",
          "x-request-id": requestId,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      console.log(`[CONTAINER:${requestId}] Local response: ${response.status}`, result);
      return result;
    } catch (error) {
      console.error(`[CONTAINER:${requestId}] Local fetch error:`, error);
      throw error;
    }
  }

  // Production: Cloudflare Container binding
  try {
    console.log(`[CONTAINER:${requestId}] Production call to container${path}`);
    const { getContainer, switchPort } = await import("@cloudflare/containers");
    const container = getContainer(_containerBinding, crypto.randomUUID());

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-request-id": requestId
    };
    if (_zenApiKey) {
      headers["x-zen-api-key"] = _zenApiKey;
    }
    console.log(`[CONTAINER:${requestId}] Headers:`, headers);

    const res = await container.fetch(
      switchPort(
        new Request(`http://container${path}`, {
          method: "POST",
          headers,
          body: body ? JSON.stringify(body) : undefined,
        }),
        8081
      )
    );

    console.log(`[CONTAINER:${requestId}] Production response: ${res.status}`);
    const result = await res.json();
    console.log(`[CONTAINER:${requestId}] Result:`, result);
    return result;
  } catch (error) {
    console.error(`[CONTAINER:${requestId}] Error calling container:`, error);
    throw error;
  }
}

export async function doThis(prompt: string, options: any = {}): Promise<any> {
  const { schema, maxIterations = 5, timeout = 60000 } = options;

  console.log(`[RALPH] doThis called with prompt: ${prompt}`);

  try {
    const result = await containerFetch("/do", {
      prompt,
      maxIterations,
      timeout,
      schema: schema ? JSON.stringify(schema) : undefined
    });

    console.log(`[RALPH] doThis result:`, result);
    return result;
  } catch (error) {
    console.error(`[RALPH] doThis error:`, error);
    throw error;
  }
}