#!/usr/bin/env bun

/**
 * RalphWiggums Test Script
 * Tests the demo endpoint and provides debugging info
 * Usage: bun run test:demo [--url=https://ralphwiggums.coey.dev]
 */

const DEMO_URL = process.argv.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'https://ralphwiggums.coey.dev';

console.log(`🧪 Testing RalphWiggums demo at ${DEMO_URL}`);
console.log(`📊 Time: ${new Date().toISOString()}`);
console.log('');

async function testDemo() {
  const testData = {
    url: 'https://example.com',
    instructions: 'Extract the page title and main heading'
  };

  console.log('📤 Sending request:', JSON.stringify(testData, null, 2));
  console.log('');

  try {
    const startTime = Date.now();
    const response = await fetch(`${DEMO_URL}/api/product-research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RalphWiggums-Test/1.0'
      },
      body: JSON.stringify(testData)
    });
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`📥 Response received in ${duration}ms`);
    console.log(`🔢 Status: ${response.status} ${response.statusText}`);
    console.log(`📄 Headers:`, Object.fromEntries(response.headers.entries()));
    console.log('');

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success! Result:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:');
      console.log(errorText);
    }

    console.log('');
    console.log('🔍 Check wrangler tails for detailed logs:');
    console.log(`   wrangler tail ralphwiggums-ralphwiggums-api-prod`);
    console.log(`   wrangler tail <CONTAINER_DO_NAME>`);

  } catch (error) {
    console.log('💥 Network error:');
    console.error(error);
  }
}

// Run health check first
async function checkHealth() {
  try {
    const response = await fetch(`${DEMO_URL}/api/health`);
    if (response.ok) {
      console.log('💚 Health check passed');
    } else {
      console.log('💔 Health check failed:', response.status);
    }
  } catch (error) {
    console.log('💔 Health check error:', error.message);
  }
  console.log('');
}

async function main() {
  await checkHealth();
  await testDemo();
}

main().catch(console.error);