#!/usr/bin/env bun

/**
 * E2E Test for Production Product Research API
 * Uses gateproof to test the production demo endpoint
 * 
 * Run: bun run scripts/e2e-production-test.ts
 */

import { Gate, Act, Assert, createEmptyObserveResource } from "gateproof";

const PRODUCTION_URL = "https://ralphwiggums.coey.dev";
const API_ENDPOINT = `${PRODUCTION_URL}/api/product-research`;

interface ProductResearchRequest {
  url: string;
  instructions: string;
}

interface ProductResearchResponse {
  success: boolean;
  data?: unknown;
  iterations?: number;
  message?: string;
}

// Store response globally for assertions
let apiResponse: ProductResearchResponse | null = null;
let apiResponseText = "";
let response: Response | null = null;

async function main() {
  console.log("🧪 Gateproof E2E Test: Production Product Research API");
  console.log("========================================================");
  console.log(`Testing: ${API_ENDPOINT}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");

  const requestBody: ProductResearchRequest = {
    url: "https://amazon.com/dp/B09V3KXJPB",
    instructions: "name, price, description, key features, star rating, in stock status"
  };

  try {
    // Make HTTP request as an action
    response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9,it;q=0.8",
        "content-type": "application/json",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "Referer": `${PRODUCTION_URL}/`
      },
      body: JSON.stringify(requestBody)
    });

    apiResponseText = await response.text();

    // Try to parse response even if HTTP status is not OK
    try {
      apiResponse = JSON.parse(apiResponseText) as ProductResearchResponse;
    } catch (parseError) {
      // If parsing fails, still try to run gateproof to report the error
      console.error(`⚠️  Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      console.error(`   Response text: ${apiResponseText.substring(0, 500)}`);
      // Continue to gateproof assertions which will catch this
    }

    // If HTTP error, log it but continue to gateproof for proper error reporting
    if (!response.ok) {
      console.error(`⚠️  HTTP error: ${response.status} ${response.statusText}`);
    }

    // Run gateproof with assertions
    const result = await Gate.run({
      // No observability backend needed for simple API test
      observe: createEmptyObserveResource(),
      
      act: [
        // Mark that we've performed the API call (already done above)
        Act.wait(100)
      ],
      
      assert: [
        // Assert: HTTP status is OK
        Assert.custom("http_status_ok", (logs) => {
          if (response.status !== 200) {
            console.error(`❌ HTTP status is not 200: ${response.status} ${response.statusText}`);
            return false;
          }
          return true;
        }),

        // Assert: Response is valid object
        Assert.custom("response_is_object", (logs) => {
          if (typeof apiResponse !== "object" || apiResponse === null) {
            console.error("❌ Response is not an object");
            return false;
          }
          return true;
        }),

        // Assert: success field is true
        Assert.custom("response_success", (logs) => {
          if (!apiResponse || apiResponse.success !== true) {
            console.error(`❌ Expected success: true, got: ${apiResponse?.success ?? "undefined"}`);
            if (apiResponse?.message) {
              console.error(`   Message: ${apiResponse.message}`);
            }
            return false;
          }
          return true;
        }),

        // Assert: data field exists and is non-empty
        Assert.custom("response_has_data", (logs) => {
          if (!apiResponse || !apiResponse.data) {
            console.error("❌ Response missing data field or data is empty");
            return false;
          }

          // Check if data is a string (should be non-empty)
          if (typeof apiResponse.data === "string" && apiResponse.data.trim().length === 0) {
            console.error("❌ Response data is empty string");
            return false;
          }

          // Check if data is an object (should have properties)
          if (typeof apiResponse.data === "object" && Object.keys(apiResponse.data).length === 0) {
            console.error("❌ Response data is empty object");
            return false;
          }

          return true;
        })
      ]
    });

    if (result.status === "success") {
      console.log("");
      console.log("✅ All assertions passed");
      console.log(`   - success: ${apiResponse!.success}`);
      console.log(`   - data exists: ${apiResponse!.data !== undefined}`);
      console.log(`   - iterations: ${apiResponse!.iterations ?? "N/A"}`);
      if (apiResponse!.message) {
        console.log(`   - message: ${apiResponse!.message}`);
      }
      console.log(`   Duration: ${result.durationMs}ms`);
      process.exit(0);
    } else {
      console.log("");
      console.log(`❌ Test failed: ${result.status}`);
      if (result.error) {
        console.error(`   Error: ${result.error.message}`);
      }
      process.exit(1);
    }

  } catch (error) {
    console.error("💥 Test execution failed:", error);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

// Fallback implementation without gateproof (for debugging)
async function mainWithFetch() {
  console.log("🧪 Gateproof E2E Test: Production Product Research API (Fetch)");
  console.log("===============================================================");
  console.log(`Testing: ${API_ENDPOINT}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");

  const requestBody: ProductResearchRequest = {
    url: "https://amazon.com/dp/B09V3KXJPB",
    instructions: "name, price, description, key features, star rating, in stock status"
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9,it;q=0.8",
        "content-type": "application/json",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "Referer": `${PRODUCTION_URL}/`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP error: ${response.status} ${response.statusText}`);
      console.error(`   Response: ${errorText}`);
      process.exit(1);
    }

    const result = await response.json() as ProductResearchResponse;

    // Validate response structure
    if (typeof result !== "object" || result === null) {
      console.error("❌ Response is not an object");
      process.exit(1);
    }

    if (result.success !== true) {
      console.error(`❌ Expected success: true, got: ${result.success}`);
      if (result.message) {
        console.error(`   Message: ${result.message}`);
      }
      process.exit(1);
    }

    if (!result.data) {
      console.error("❌ Response missing data field or data is empty");
      process.exit(1);
    }

    if (typeof result.data === "string" && result.data.trim().length === 0) {
      console.error("❌ Response data is empty string");
      process.exit(1);
    }

    if (typeof result.data === "object" && Object.keys(result.data).length === 0) {
      console.error("❌ Response data is empty object");
      process.exit(1);
    }

    console.log("✅ Response validation passed:");
    console.log(`   - success: ${result.success}`);
    console.log(`   - data exists: ${result.data !== undefined}`);
    console.log(`   - iterations: ${result.iterations ?? "N/A"}`);
    if (result.message) {
      console.log(`   - message: ${result.message}`);
    }

    console.log("");
    console.log("✅ All assertions passed");
    process.exit(0);

  } catch (error) {
    console.error("💥 Test execution failed:", error);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

// Use gateproof-based implementation as primary
if (import.meta.main) {
  main().catch(error => {
    console.error("💥 Unhandled error:", error);
    process.exit(1);
  });
}

export { main, mainWithFetch };
