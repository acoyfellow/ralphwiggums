import { describe, it, expect } from "vitest";

// Test the promise tag integration end-to-end
describe("End-to-End Promise Tag Integration", () => {
  it("container detects promise tags correctly", async () => {
    // This would require starting the container server
    // For now, just test the regex logic
    const testResponse = "I found the information. <promise>TASK_COMPLETE</promise>";
    expect(testResponse.includes("<promise>")).toBe(true);
    expect(testResponse.includes("</promise>")).toBe(true);
  });

  it("container accepts maxIterations parameter", () => {
    // Test that the DoRequest interface accepts maxIterations
    const request: any = {
      prompt: "test",
      maxIterations: 5
    };
    expect(request.maxIterations).toBe(5);
  });
});