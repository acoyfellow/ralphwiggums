/**
 * ralphwiggums - Checkpoint DO Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInMemoryCheckpointStore,
  CheckpointDO,
  type CheckpointData,
  type CheckpointStore,
} from "../checkpoint-do.js";

describe("Checkpoint DO", () => {
  describe("In-Memory Store", () => {
    let store: CheckpointStore;

    beforeEach(() => {
      store = createInMemoryCheckpointStore();
    });

    it("should save and load checkpoints", async () => {
      const checkpoint: CheckpointData = {
        checkpointId: "test-task-0",
        taskId: "test-task",
        iteration: 0,
        url: "https://example.com",
        pageState: "form-filled",
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      await store.save(checkpoint);
      const loaded = await store.load("test-task-0");

      expect(loaded).toBeDefined();
      expect(loaded?.checkpointId).toBe("test-task-0");
      expect(loaded?.taskId).toBe("test-task");
      expect(loaded?.url).toBe("https://example.com");
    });

    it("should return null for non-existent checkpoint", async () => {
      const loaded = await store.load("non-existent");
      expect(loaded).toBeNull();
    });

    it("should delete checkpoints", async () => {
      const checkpoint: CheckpointData = {
        checkpointId: "test-task-0",
        taskId: "test-task",
        iteration: 0,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      await store.save(checkpoint);
      await store.delete("test-task-0");

      const loaded = await store.load("test-task-0");
      expect(loaded).toBeNull();
    });

    it("should list checkpoints by task ID", async () => {
      const checkpoint1: CheckpointData = {
        checkpointId: "task-a-0",
        taskId: "task-a",
        iteration: 0,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const checkpoint2: CheckpointData = {
        checkpointId: "task-a-1",
        taskId: "task-a",
        iteration: 1,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const checkpoint3: CheckpointData = {
        checkpointId: "task-b-0",
        taskId: "task-b",
        iteration: 0,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      await store.save(checkpoint1);
      await store.save(checkpoint2);
      await store.save(checkpoint3);

      const taskACheckpoints = await store.list("task-a");
      expect(taskACheckpoints).toHaveLength(2);

      const taskBCheckpoints = await store.list("task-b");
      expect(taskBCheckpoints).toHaveLength(1);
    });

    it("should garbage collect expired checkpoints", async () => {
      const checkpoint: CheckpointData = {
        checkpointId: "test-task-0",
        taskId: "test-task",
        iteration: 0,
        timestamp: Date.now(),
        expiresAt: Date.now() - 1000, // Already expired
      };

      await store.save(checkpoint);
      await store.gc();

      const loaded = await store.load("test-task-0");
      expect(loaded).toBeNull();
    });

    it("should not garbage collect valid checkpoints", async () => {
      const checkpoint: CheckpointData = {
        checkpointId: "test-task-0",
        taskId: "test-task",
        iteration: 0,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000, // Valid for 1 hour
      };

      await store.save(checkpoint);
      await store.gc();

      const loaded = await store.load("test-task-0");
      expect(loaded).toBeDefined();
      expect(loaded?.checkpointId).toBe("test-task-0");
    });
  });

  describe("CheckpointDO.fetch()", () => {
    it("should handle GET request for checkpoint", async () => {
      const mockStorage = {
        get: vi.fn().mockResolvedValue({
          checkpointId: "test-0",
          taskId: "test",
          iteration: 0,
          timestamp: Date.now(),
          expiresAt: Date.now() + 3600000,
        }),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue(new Map()),
      };

      const state = { storage: mockStorage };
      const env = {};
      const request = new Request("http://test/test-0", { method: "GET" });

      const response = await CheckpointDO.fetch(state, env, request);

      expect(response.status).toBe(200);
      const body = await response.json() as { checkpointId: string };
      expect(body.checkpointId).toBe("test-0");
    });

    it("should return 404 for non-existent checkpoint", async () => {
      const mockStorage = {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue(new Map()),
      };

      const state = { storage: mockStorage };
      const env = {};
      const request = new Request("http://test/non-existent", { method: "GET" });

      const response = await CheckpointDO.fetch(state, env, request);

      expect(response.status).toBe(404);
    });

    it("should handle POST /save request", async () => {
      const mockStorage = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue(new Map()),
      };

      const state = { storage: mockStorage };
      const env = {};
      const checkpointData = {
        checkpointId: "test-0",
        taskId: "test",
        iteration: 0,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      const request = new Request("http://test/save", {
        method: "POST",
        body: JSON.stringify(checkpointData),
      });

      const response = await CheckpointDO.fetch(state, env, request);

      expect(response.status).toBe(200);
      expect(mockStorage.put).toHaveBeenCalled();
    });

    it("should handle DELETE request", async () => {
      const mockStorage = {
        get: vi.fn()
          .mockResolvedValueOnce({
            checkpointId: "test-0",
            taskId: "test",
            iteration: 0,
            timestamp: Date.now(),
            expiresAt: Date.now() + 3600000,
          })
          .mockResolvedValueOnce(["test-0"]), // task_index:test
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue(new Map()),
      };

      const state = { storage: mockStorage };
      const env = {};
      const request = new Request("http://test/test-0", { method: "DELETE" });

      const response = await CheckpointDO.fetch(state, env, request);

      expect(response.status).toBe(200);
      expect(mockStorage.delete).toHaveBeenCalledWith("checkpoint:test-0");
    });

    it("should handle GET /list/:taskId request", async () => {
      const mockStorage = {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === "task_index:test-task") {
            return Promise.resolve(["test-0", "test-1"]);
          }
          if (key === "checkpoint:test-0") {
            return Promise.resolve({
              checkpointId: "test-0",
              taskId: "test-task",
              iteration: 0,
              timestamp: Date.now(),
              expiresAt: Date.now() + 3600000,
            });
          }
          if (key === "checkpoint:test-1") {
            return Promise.resolve({
              checkpointId: "test-1",
              taskId: "test-task",
              iteration: 1,
              timestamp: Date.now(),
              expiresAt: Date.now() + 3600000,
            });
          }
          return Promise.resolve(undefined);
        }),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue(new Map()),
      };

      const state = { storage: mockStorage };
      const env = {};
      const request = new Request("http://test/list/test-task", { method: "GET" });

      const response = await CheckpointDO.fetch(state, env, request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(2);
    });

    it("should handle POST /gc request", async () => {
      const mockStorage = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue(new Map()),
      };

      const state = { storage: mockStorage };
      const env = {};
      const request = new Request("http://test/gc", { method: "POST" });

      const response = await CheckpointDO.fetch(state, env, request);

      expect(response.status).toBe(200);
    });

    it("should return 405 for unknown endpoints", async () => {
      const mockStorage = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue(new Map()),
      };

      const state = { storage: mockStorage };
      const env = {};
      const request = new Request("http://test/unknown", { method: "PUT" });

      const response = await CheckpointDO.fetch(state, env, request);

      expect(response.status).toBe(405);
    });
  });
});
