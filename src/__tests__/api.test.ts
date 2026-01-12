import { test, expect } from 'bun:test';

const DEMO_URL = process.env.DEMO_URL || 'http://localhost:3000';

test('demo API returns success for simple extraction', async () => {
  const response = await fetch(`${DEMO_URL}/api/product-research`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://example.com',
      instructions: 'Extract the page title and main heading'
    })
  });

  expect(response.status).toBe(200);
  const result = await response.json();
  // For now, accept the placeholder response
  expect(result.success).toBe(true);
  expect(result.data).toBeDefined();
  expect(typeof result.iterations).toBe('number');
});

test('demo API handles invalid URL', async () => {
  const response = await fetch(`${DEMO_URL}/api/product-research`, {
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
});