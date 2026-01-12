import { test, expect, beforeAll, beforeEach, afterEach, describe, vi } from 'bun:test';
import type { Response } from '@sveltejs/kit';
import { setContainerFetch } from "../container-client";
import type { Response } from 'node';

// Determine test target: local dev or production
const IS_CI = process.env.CI === 'true';
const TEST_TARGET = process.env.DEMO_URL || (IS_CI ? 'https://ralphwiggums.coey.dev' : 'http://localhost:5173');

console.log(`[TEST] Running tests against: ${TEST_TARGET} (${IS_CI ? 'CI' : 'local dev'})`);

beforeAll(() => {
  setContainerFetch(null);
});

afterEach(() => {
  setContainerFetch(null);
});

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

  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.success).toBe(true);
  expect(result.data).toBeDefined();
  expect(result.iterations).toBe(0); // Production orchestrator doesn't use iterations
  expect(result.requestId).toBeDefined(); // Should have request tracing
  if (IS_CI) {
    expect(result.message).toBe('Task completed successfully via orchestrator');
  } else {
    expect(result.iterations).toBeGreaterThanOrEqual(1); // Local dev should have at least 1 iteration
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
