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

export function setContainerFetch(fetchFn: ((path: string, body?: object) => Promise<any>) | null) {
  _containerFetch = fetchFn;
}

export async function containerFetch(
  path: string,
  body?: object,
): Promise<any> {
  const requestId = crypto.randomUUID().slice(0, 8);

  if (_containerFetch) {
    // Use provided fetch function (for testing)
    console.log(`[CONTAINER:MOCK:${requestId}] Using mock fetch function`);
    return _containerFetch(path, body);
  }

  const containerUrl = _containerUrl || "http://localhost:8081";
  if (containerUrl) {
    // Local dev: direct HTTP call
    console.log(`[CONTAINER:MOCK:${requestId}] Local call to ${containerUrl}${path}`);
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
      console.log(`[CONTAINER:MOCK:${requestId}] Local response:`, result);
      return result;
    } catch (error) {
      console.error(`[CONTAINER:MOCK:${requestId}] Local fetch error:`, error);
      throw error;
    }
  } else {
    // Production: Cloudflare Container binding
    console.log(`[CONTAINER:MOCK:${requestId}] Production call to container${path}`);
    try {
      const { getContainer, switchPort } = await import("@cloudflare/containers");
      const container = getContainer(_containerBinding, crypto.randomUUID());
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-request-id": requestId,
      };
      if (_zenApiKey) {
        headers["x-zen-api-key"] = _zenApiKey;
      }
      console.log(`[CONTAINER:MOCK:${requestId}] Headers:`, headers);

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
      const result = await res.json();
      console.log(`[CONTAINER:MOCK:${requestId}] Production response:`, result);
      return result;
    } catch (error) {
      console.error(`[CONTAINER:MOCK:${requestId}] Production fetch error:`, error);
      throw error;
    }
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
      schema: schema ? JSON.stringify(schema) : undefined,
    });

    console.log(`[RALPH] doThis result:`, result);
    return result;
  } catch (error) {
    console.error(`[RALPH] doThis error:`, error);
    throw error;
  }
}
