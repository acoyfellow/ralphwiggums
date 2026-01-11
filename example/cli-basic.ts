/**
 * ralphwiggums Example: Basic CLI Usage
 * 
 * Simple standalone script for quick automation tasks.
 * Perfect for one-off scripts, testing, or simple automation.
 * 
 * Run: bun run example/cli-basic.ts
 * 
 * Usage:
 *   bun run example/cli-basic.ts "Go to example.com and get the title"
 */

import { run } from "ralphwiggums";
import type { RalphOptions } from "ralphwiggums";

// ============================================================================
// Example 1: Simple Extraction
// ============================================================================

export async function extractTitle(url: string) {
  const result = await run(`Go to ${url} and get the page title`);
  console.log("Title:", result.data);
  return result;
}

// ============================================================================
// Example 2: CLI Script with Arguments
// ============================================================================

export async function cliScript() {
  // Get URL from command line args
  const url = process.argv[2] || "https://example.com";
  const task = process.argv[3] || "get the page title";

  console.log(`Running task: ${task} on ${url}`);

  const options: RalphOptions = {
    maxIterations: 5,
    timeout: 60000,
  };

  try {
    const result = await run(`Go to ${url} and ${task}`, options);
    
    if (result.success) {
      console.log("✅ Success!");
      console.log("Data:", result.data);
      console.log("Iterations:", result.iterations);
    } else {
      console.error("❌ Failed:", result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// ============================================================================
// Example 3: Interactive CLI
// ============================================================================

export async function interactiveCLI() {
  // In a real CLI, you'd use readline or a library like inquirer
  // This shows the pattern for building interactive tools
  
  const tasks = [
    { url: "https://example.com", task: "get the page title" },
    { url: "https://example.com", task: "find all links" },
    { url: "https://example.com", task: "extract meta description" },
  ];

  for (const { url, task } of tasks) {
    console.log(`\n📋 Task: ${task} on ${url}`);
    const result = await run(`Go to ${url} and ${task}`, {
      maxIterations: 3,
      timeout: 30000,
    });
    
    if (result.success) {
      console.log("✅ Result:", result.data);
    } else {
      console.log("⚠️  Failed:", result.message);
    }
  }
}

// ============================================================================
// Usage
// ============================================================================

// Run if called directly
if (import.meta.main) {
  cliScript().catch(console.error);
}
