/**
 * ralphwiggums - Container Server Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";

// ============================================================================
// Mock Stagehand
// ============================================================================

const mockStagehand = {
  init: async () => {},
  close: async () => {},
  act: async (_cmd: string) => "TASK_COMPLETE",
  extract: async (_instr: string, _schema: unknown) => ({ name: "Test Product", price: "$99" }),
  observe: async (_query: string) => [],
};

// ============================================================================
// Test Server Helpers
// ============================================================================

async function createTestServer() {
  const { createServer, resetBrowser, setBrowser } = await import("../../container/server.js");
  resetBrowser();
  // Inject mock browser
  setBrowser(mockStagehand as any);
  const server = createServer(mockStagehand as any);
  return { server, resetBrowser, setBrowser };
}

async function makeRequest(server: http.Server, options: {
  method: string;
  path: string;
  body?: unknown;
}): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: (server.address() as any)?.port,
        method: options.method,
        path: options.path,
        headers: {
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 500, body: data });
          }
        });
      }
    );

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("Container Server Endpoints", () => {
  let server: http.Server;

  beforeEach(async () => {
    const { server: s } = await createTestServer();
    server = s;
    await new Promise((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  describe("GET /health", () => {
    it("returns healthy status", async () => {
      const res = await makeRequest(server, { method: "GET", path: "/health" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { status: "healthy", browser: true },
      });
    });
  });

  describe("POST /start", () => {
    it("initializes browser", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/start",
        body: {},
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { connected: true },
      });
    });

    it("accepts custom viewport and colorScheme", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/start",
        body: {
          viewport: { width: 1920, height: 1080 },
          colorScheme: "light",
        },
      });
      expect(res.status).toBe(200);
    });

    it("rejects invalid viewport dimensions", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/start",
        body: {
          viewport: { width: -1, height: 720 },
        },
      });
      expect(res.status).toBe(400);
      expect((res.body as any).error).toContain("Invalid viewport");
    });

    it("rejects zero dimensions", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/start",
        body: {
          viewport: { width: 0, height: 0 },
        },
      });
      expect(res.status).toBe(400);
    });

    it("clamps absurdly large dimensions", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/start",
        body: {
          viewport: { width: 99999, height: 99999 },
        },
      });
      expect(res.status).toBe(200);
      // Should accept but clamp to max
    });
  });

  describe("POST /instruction", () => {
    it("executes act command", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/instruction",
        body: { instruction: "click the submit button" },
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: "TASK_COMPLETE",
      });
    });

    it("returns blocked status when action fails", async () => {
      mockStagehand.act = async (_cmd: string) => "BLOCKED: Could not find button";
      const res = await makeRequest(server, {
        method: "POST",
        path: "/instruction",
        body: { instruction: "click non-existent button" },
      });
      expect(res.status).toBe(200);
      expect((res.body as any).data).toContain("BLOCKED");
    });

    it("requires instruction field", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/instruction",
        body: {},
      });
      expect(res.status).toBe(400);
      expect((res.body as any).error).toBe("instruction is required");
    });

    it("returns 500 when browser not initialized", async () => {
      const { createServer, resetBrowser, setBrowser } = await import("../../container/server.js");
      resetBrowser();
      const testServer = createServer();
      
      await new Promise((resolve) => testServer.listen(0, resolve));
      
      const res = await makeRequest(testServer, {
        method: "POST",
        path: "/instruction",
        body: { instruction: "click something" },
      });
      
      await new Promise((resolve) => testServer.close(resolve));
      expect(res.status).toBe(500);
      expect((res.body as any).error).toContain("not initialized");
    });
  });

  describe("POST /extract", () => {
    it("extracts data with schema", async () => {
      mockStagehand.extract = async (_instr: string, _schema: unknown) => ({
        name: "MacBook Pro",
        price: "$1,999",
      });
      const res = await makeRequest(server, {
        method: "POST",
        path: "/extract",
        body: {
          instruction: "extract product info",
          schema: { type: "object", properties: { name: { type: "string" } } },
        },
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { name: "MacBook Pro", price: "$1,999" },
      });
    });

    it("requires instruction", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/extract",
        body: { schema: {} },
      });
      expect(res.status).toBe(400);
      expect((res.body as any).error).toBe("instruction is required");
    });

    it("requires schema", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/extract",
        body: { instruction: "extract data" },
      });
      expect(res.status).toBe(400);
      expect((res.body as any).error).toBe("schema is required");
    });
  });

  describe("POST /stop", () => {
    it("closes browser and returns success", async () => {
      const res = await makeRequest(server, {
        method: "POST",
        path: "/stop",
        body: {},
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: null,
      });
    });
  });

  describe("404 handling", () => {
    it("returns 404 for unknown paths", async () => {
      const res = await makeRequest(server, {
        method: "GET",
        path: "/unknown",
      });
      expect(res.status).toBe(404);
      expect((res.body as any).error).toContain("Not found");
    });

    it("returns 404 for wrong methods", async () => {
      const res = await makeRequest(server, {
        method: "GET",
        path: "/start",
      });
      expect(res.status).toBe(404);
    });
  });
});

describe("Container Server - Helper Functions", () => {
  it("json helper creates correct response", async () => {
    const { json } = await import("../../container/server.js");
    const response = json({ success: true }, 201);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  it("createError helper creates error response", async () => {
    const { createError } = await import("../../container/server.js");
    const response = createError("Something went wrong", 500);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: "Something went wrong" });
  });
});
