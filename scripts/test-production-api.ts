#!/usr/bin/env bun

/**
 * Production API Test Script
 * Tests the production API endpoints directly
 * Usage: bun run scripts/test-production-api.ts [--url=https://ralphwiggums-api.coey.dev]
 */

const API_URL = process.argv.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'https://ralphwiggums-api.coey.dev';

console.log(`🧪 Testing RalphWiggums Production API`);
console.log(`========================================`);
console.log(`API URL: ${API_URL}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log('');

async function testEndpoint(method: string, path: string, body?: object) {
  const url = `${API_URL}${path}`;
  console.log(`\n${method} ${path}`);
  console.log('-'.repeat(50));

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RalphWiggums-ProductionTest/1.0',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const startTime = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration}ms`);

    const contentType = response.headers.get('content-type');
    let data;
    if (contentType?.includes('application/json')) {
      data = await response.json();
      console.log(`Response: ${JSON.stringify(data, null, 2)}`);
    } else {
      data = await response.text();
      console.log(`Response: ${data.substring(0, 200)}`);
    }

    return { ok: response.ok, status: response.status, data, duration };
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

async function main() {
  // Test health endpoint
  await testEndpoint('GET', '/health');

  // Test debug endpoint
  await testEndpoint('GET', '/debug');

  // Test /do endpoint
  await testEndpoint('POST', '/do', {
    prompt: 'Go to https://example.com and get the page title',
    maxIterations: 1,
  });

  // Test orchestrator endpoints
  await testEndpoint('GET', '/orchestrator/pool');
  await testEndpoint('GET', '/orchestrator/tasks');
  await testEndpoint('POST', '/orchestrator/queue', {
    prompt: 'Test task',
  });

  // Test SvelteKit API endpoints (should be on demo domain)
  console.log('\n\n========================================');
  console.log('Testing SvelteKit API (should be on demo domain)');
  console.log('========================================\n');

  const demoUrl = 'https://ralphwiggums.coey.dev';
  await fetch(`${demoUrl}/api/product-research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://example.com',
      instructions: 'Get the page title',
    }),
  }).then(async (r) => {
    const data = await r.json();
    console.log(`POST /api/product-research: ${r.status}`);
    console.log(`Response: ${JSON.stringify(data, null, 2)}`);
  }).catch((e) => {
    console.log(`Error: ${e.message}`);
  });
}

main().catch(console.error);
