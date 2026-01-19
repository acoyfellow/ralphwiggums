#!/usr/bin/env bun

/**
 * Core API Harness for ralphwiggums
 * Tests the core run() function directly (npm package API)
 * 
 * Story 023 - Acceptance Criteria #4: Uses npm module (ralphwiggums) for programmatic testing
 * 
 * Usage: CONTAINER_URL=http://localhost:8081 bun run test:core
 */

import { run, setContainerUrl } from "../dist/src/index.js";

const CONTAINER_URL = process.env.CONTAINER_URL || 'http://localhost:8081';

async function testCoreAPI() {
  console.log('🧪 Testing Core ralphwiggums API (run function)');
  console.log(`📊 Container: ${CONTAINER_URL}`);
  console.log(`📊 Time: ${new Date().toISOString()}\n`);

  // Set container URL
  setContainerUrl(CONTAINER_URL);

  // Test 1: Simple extraction
  console.log('Test 1: Extract page title...');
  try {
    const result = await run("Go to https://example.com and get the page title", {
      maxIterations: 3,
      timeout: 30000
    });

    if (result.success && result.data) {
      console.log('✅ Test 1 PASSED');
      console.log(`   Result: ${String(result.data).substring(0, 100)}`);
      console.log(`   Iterations: ${result.iterations}`);
    } else {
      console.log('❌ Test 1 FAILED');
      console.log(`   Message: ${result.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Test 1 FAILED');
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  console.log('\n✅ All core API tests passed');
  process.exit(0);
}

testCoreAPI().catch(error => {
  console.error('💥 Harness failed:', error);
  process.exit(1);
});
