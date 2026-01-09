/**
 * E2E Tests for RalphWiggums
 *
 * These tests verify the API works end-to-end with real browser automation.
 * They DO NOT mock Stagehand - they exercise the full flow.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { run } from "../index.js";
describe("E2E - Real Browser Automation", () => {
    beforeAll(() => {
        if (!process.env.CONTAINER_URL) {
            console.log("Skipping E2E tests: CONTAINER_URL not set");
        }
    });
    it("should navigate to example.com and extract title", { timeout: 30000 }, async () => {
        if (!process.env.CONTAINER_URL)
            return;
        const result = await run("Go to https://example.com and get the page title", {
            maxIterations: 3,
        });
        expect(result.success).toBe(true);
        expect(result.data).toBeTruthy();
        expect(result.iterations).toBeGreaterThan(0);
        expect(result.iterations).toBeLessThanOrEqual(3);
        if (result.data) {
            expect(String(result.data).toLowerCase()).toContain("example");
        }
    });
    it("should navigate and extract visible text from example.com", { timeout: 30000 }, async () => {
        if (!process.env.CONTAINER_URL)
            return;
        const result = await run("Extract from https://example.com: all visible text on the page", { maxIterations: 3 });
        expect(result.success).toBe(true);
        expect(result.data).toBeTruthy();
        if (typeof result.data === "string") {
            expect(result.data.length).toBeGreaterThan(10);
        }
    });
    it("should handle action tasks (navigate + description)", { timeout: 30000 }, async () => {
        if (!process.env.CONTAINER_URL)
            return;
        const result = await run("Go to https://example.com, find any link and describe it", { maxIterations: 3 });
        expect(result.success).toBe(true);
        expect(result.iterations).toBeGreaterThan(0);
    });
    it("should handle timeout gracefully", { timeout: 35000 }, async () => {
        if (!process.env.CONTAINER_URL)
            return;
        const result = await run("Go to https://example.com and wait for something that will never appear", { maxIterations: 1, timeout: 5000 });
        expect(result.success).toBe(false);
        if (result.message) {
            expect(result.message.includes("timed out")).toBe(true);
        }
    });
    it("should handle max iterations gracefully", { timeout: 60000 }, async () => {
        if (!process.env.CONTAINER_URL)
            return;
        const result = await run("Extract a number that will randomly change on every page load from https://example.com", { maxIterations: 2 });
        expect(result.success).toBe(true);
        expect(result.iterations).toBeLessThanOrEqual(2);
    });
    it("should handle empty prompt with validation error", { timeout: 10000 }, async () => {
        if (!process.env.CONTAINER_URL)
            return;
        await expect(run("", { maxIterations: 1 })).rejects.toThrow();
    });
    it("should handle extremely long prompt with validation error", { timeout: 10000 }, async () => {
        if (!process.env.CONTAINER_URL)
            return;
        const longPrompt = "x".repeat(100000);
        await expect(run(longPrompt, { maxIterations: 1 })).rejects.toThrow();
    });
});
describe("E2E - Real Form Interaction", () => {
    beforeAll(() => {
        if (!process.env.CONTAINER_URL) {
            console.log("Skipping form E2E tests: CONTAINER_URL not set");
        }
    });
    it("should navigate to a contact form page and extract form fields", { timeout: 30000 }, async () => {
        if (!process.env.CONTAINER_URL)
            return;
        const result = await run("Go to https://example.com/contact and list all form fields on the page", { maxIterations: 3 });
        expect(result.success).toBe(true);
        expect(result.data).toBeTruthy();
        if (result.data) {
            expect(String(result.data).length).toBeGreaterThan(0);
        }
    });
    it("should handle navigation to non-existent page gracefully", { timeout: 30000 }, async () => {
        if (!process.env.CONTAINER_URL)
            return;
        const result = await run("Go to https://this-domain-definitely-does-not-exist-12345.com and get the page title", { maxIterations: 2 });
        expect(result.success).toBe(false);
    });
});
//# sourceMappingURL=e2e.test.js.map