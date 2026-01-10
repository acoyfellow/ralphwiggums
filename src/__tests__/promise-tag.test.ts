import { describe, it, expect } from "vitest";

// Test promise tag detection logic
const PROMISE_TAG_REGEX = /<promise>(.*?)<\/promise>/gi;

function detectPromiseTag(text: string): string | null {
  // Reset regex lastIndex for consistent behavior
  PROMISE_TAG_REGEX.lastIndex = 0;
  const match = PROMISE_TAG_REGEX.exec(text);
  return match ? match[1] : null;
}

describe("Promise Tag Detection", () => {
  it("should detect promise tag in extraction result", () => {
    const result = "I found the information you requested. <promise>TASK_COMPLETE</promise>";
    expect(detectPromiseTag(result)).toBe("TASK_COMPLETE");
  });

  it("should detect promise tag in action result", () => {
    const result = "Successfully clicked the submit button. <promise>FORM_SUBMITTED</promise>";
    expect(detectPromiseTag(result)).toBe("FORM_SUBMITTED");
  });

  it("should return null when no promise tag", () => {
    const result = "Task completed successfully without promise tag";
    expect(detectPromiseTag(result)).toBeNull();
  });

  it("should handle empty promise text", () => {
    const result = "Task done <promise></promise>";
    expect(detectPromiseTag(result)).toBe("");
  });

  it("should handle multi-line content", () => {
    const result = `Task completed:
- Item 1 found
- Item 2 found
<promise>MULTI_LINE_COMPLETE</promise>`;
    expect(detectPromiseTag(result)).toBe("MULTI_LINE_COMPLETE");
  });
});