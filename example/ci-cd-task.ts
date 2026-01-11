/**
 * ralphwiggums Example: CI/CD Task
 * 
 * Example script for running automation tasks in CI/CD pipelines.
 * This can be used for:
 * - Automated testing
 * - Data collection
 * - Website monitoring
 * - Content validation
 * 
 * Run in CI/CD:
 *   bun run example/ci-cd-task.ts
 */

import { run } from "ralphwiggums";
import { writeFileSync } from "fs";

// ============================================================================
// Example 1: Simple CI/CD Task
// ============================================================================

export async function ciTask() {
  const task = process.env.CI_TASK || "Go to example.com and get the page title";
  
  console.log("🤖 Starting CI/CD automation task...");
  console.log(`Task: ${task}`);

  try {
    const result = await run(task, {
      maxIterations: 5,
      timeout: 60000,
    });

    if (result.success) {
      console.log("✅ Task completed successfully");
      console.log("Result:", result.data);
      
      // Save results for artifact upload
      writeFileSync("results.json", JSON.stringify({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      }, null, 2));

      process.exit(0);
    } else {
      console.error("❌ Task failed:", result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// ============================================================================
// Example 2: Website Health Check
// ============================================================================

export async function healthCheck(url: string) {
  console.log(`🔍 Checking health of ${url}...`);

  try {
    const result = await run(`Go to ${url} and check:
      - Is the page loading?
      - Is there a title?
      - Are there any error messages visible?
      - What is the main heading?`, {
      maxIterations: 3,
      timeout: 30000,
    });

    const isHealthy = result.success && result.data;
    
    console.log(isHealthy ? "✅ Site is healthy" : "⚠️  Site may have issues");
    console.log("Details:", result.data);

    return isHealthy;
  } catch (error) {
    console.error("❌ Health check failed:", error);
    return false;
  }
}

// ============================================================================
// Example 3: Content Validation
// ============================================================================

export async function validateContent(url: string, expectedContent: string[]) {
  console.log(`✅ Validating content on ${url}...`);

  const checks = expectedContent.map(content => 
    `Check if "${content}" is present on the page`
  ).join("\n");

  try {
    const result = await run(`Go to ${url} and ${checks}`, {
      maxIterations: 5,
      timeout: 60000,
    });

    const isValid = result.success;
    console.log(isValid ? "✅ Content validation passed" : "❌ Content validation failed");

    return isValid;
  } catch (error) {
    console.error("❌ Validation error:", error);
    return false;
  }
}

// ============================================================================
// Example 4: Scheduled Data Collection
// ============================================================================

export async function collectData(urls: string[], extractInstructions: string) {
  console.log(`📊 Collecting data from ${urls.length} URLs...`);

  const results = [];

  for (const url of urls) {
    try {
      const result = await run(`Go to ${url} and ${extractInstructions}`, {
        maxIterations: 5,
        timeout: 60000,
      });

      results.push({
        url,
        success: result.success,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        url,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Save collected data
  writeFileSync("collected-data.json", JSON.stringify(results, null, 2));
  console.log(`✅ Collected data from ${results.filter(r => r.success).length}/${urls.length} URLs`);

  return results;
}

// ============================================================================
// Run if called directly
// ============================================================================

if (import.meta.main) {
  ciTask().catch(console.error);
}
