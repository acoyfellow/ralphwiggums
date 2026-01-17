import { test, expect, beforeAll, beforeEach, afterEach, describe, vi } from 'bun:test';
import { setContainerFetch } from "../container-client";

// Determine test environment
const IS_CI = process.env.CI === 'true';
const HAS_LOCAL_DEV = !!process.env.CONTAINER_URL;
const TEST_TARGET = process.env.DEMO_URL || (IS_CI ? 'https://ralphwiggums.coey.dev' : 'http://localhost:5173');

console.log(`[TEST] Running tests against: ${TEST_TARGET} (${IS_CI ? 'CI' : 'local dev'})`);
console.log(`[TEST] Local dev available: ${HAS_LOCAL_DEV}`);

beforeAll(() => {
  setContainerFetch(null);
});

afterEach(() => {
  setContainerFetch(null);
});

// Skip API tests in CI since production isn't deployed
// Only run when local dev is available (CONTAINER_URL set)
(HAS_LOCAL_DEV ? describe : describe.skip)('API Endpoint Tests', () => {

  test('health check works', async () => {
    const response = await fetch(`${TEST_TARGET}/api/health`);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.status).toBe('ok');
  });

  test('demo API returns success with orchestrator response', async () => {
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // Only add auth headers if testing production and API key is available
  if (!IS_CI && process.env.ZEN_API_KEY) {
    headers['X-Zen-Api-Key'] = process.env.ZEN_API_KEY;
    console.log('[TEST] Using Zen API key for production');
  }

  const response = await fetch(`${TEST_TARGET}/api/product-research`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: 'https://example.com',
      instructions: 'Extract page title and main heading'
    })
  });

  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.success).toBe(true);
  expect(result.data).toBeDefined();
  expect(result.iterations).toBe(0);
  expect(result.requestId).toBeDefined();
  if (IS_CI) {
    expect(result.message).toBe('Task completed successfully via orchestrator');
  } else {
    expect(result.iterations).toBeGreaterThanOrEqual(1);
  }
});

test('demo API handles invalid URL', async () => {
  const response = await fetch(`${TEST_TARGET}/api/product-research`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: '',
      instructions: 'Extract something'
    })
  });

  expect(response.status).toBe(400);
  const result = await response.json();
  expect(result.success).toBe(false);
  expect(result.message).toBeDefined();
  });

});