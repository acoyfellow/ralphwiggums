#!/usr/bin/env bun

/**
 * Production Harness for RalphWiggums
 * End-to-end testing and systematic debugging of production deployment
 *
 * Tests the full pipeline: Frontend → Worker → Durable Objects → Container
 * If any layer fails, provides systematic debugging with log tailing
 */

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://ralphwiggums.coey.dev';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

interface TestResult {
  layer: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

class ProductionHarness {
  private results: TestResult[] = [];

  async runFullTest(): Promise<boolean> {
    console.log('🔍 RalphWiggums Production Harness');
    console.log('=====================================');
    console.log(`Testing: ${PRODUCTION_URL}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('');

    // Layer 1: Frontend (static site)
    await this.testFrontend();

    // Layer 2: Worker API endpoints
    await this.testWorkerAPI();

    // Layer 3: Durable Objects (if API works)
    if (this.results.find(r => r.layer === 'Worker API')?.status === 'PASS') {
      await this.testDurableObjects();
    }

    // Layer 4: Container (if DO works)
    if (this.results.find(r => r.layer === 'Durable Objects')?.status === 'PASS') {
      await this.testContainer();
    }

    this.printSummary();
    return this.allTestsPass();
  }

  private async testFrontend(): Promise<void> {
    console.log('📄 Testing Frontend (Static Site)...');

    try {
      // Test homepage load
      const response = await fetch(PRODUCTION_URL);
      if (!response.ok) {
        this.results.push({
          layer: 'Frontend',
          status: 'FAIL',
          message: `Homepage returned ${response.status}`,
          details: { status: response.status, url: PRODUCTION_URL }
        });
        return;
      }

      const html = await response.text();
      if (!html.includes('RalphWiggums') && !html.includes('ralphwiggums')) {
        this.results.push({
          layer: 'Frontend',
          status: 'FAIL',
          message: 'Homepage does not contain expected content',
          details: { htmlLength: html.length }
        });
        return;
      }

      // Test demo form exists
      if (!html.includes('Run Extraction') && !html.includes('Target URL')) {
        this.results.push({
          layer: 'Frontend',
          status: 'FAIL',
          message: 'Demo form not found on homepage',
          details: { hasForm: false }
        });
        return;
      }

      this.results.push({
        layer: 'Frontend',
        status: 'PASS',
        message: 'Homepage loads correctly with demo form',
        details: { status: response.status, hasDemoForm: true }
      });

    } catch (error) {
      this.results.push({
        layer: 'Frontend',
        status: 'FAIL',
        message: `Frontend test failed: ${error.message}`,
        details: error
      });
    }
  }

  private async testWorkerAPI(): Promise<void> {
    console.log('⚙️ Testing Worker API...');

    try {
      // Test health endpoint
      const healthResponse = await fetch(`${PRODUCTION_URL}/health`);
      let healthData;
      try {
        healthData = await healthResponse.json();
      } catch (parseError) {
        this.results.push({
          layer: 'Worker API',
          status: 'FAIL',
          message: `Health endpoint returned invalid JSON: ${parseError.message}`,
          details: { parseError: parseError.message, status: healthResponse.status }
        });
        await this.debugWorkerLogs('Health endpoint returning invalid response');
        return;
      }

      if (!healthResponse.ok || healthData.status !== 'ok') {
        this.results.push({
          layer: 'Worker API',
          status: 'FAIL',
          message: `Health check failed: ${healthResponse.status}`,
          details: { healthResponse: healthData, status: healthResponse.status }
        });
        await this.debugWorkerLogs('Health endpoint failing');
        return;
      }

      // Test product-research API
      const testData = {
        url: 'https://example.com',
        instructions: 'Extract the page title'
      };

      let apiResponse;
      try {
        apiResponse = await fetch(`${PRODUCTION_URL}/api/product-research`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        });
      } catch (fetchError) {
        this.results.push({
          layer: 'Worker API',
          status: 'FAIL',
          message: `API connection failed: ${fetchError.message}`,
          details: { fetchError: fetchError.message, testData }
        });
        await this.debugWorkerLogs('API connection failed');
        return;
      }

      if (!apiResponse.ok) {
        let responseText = '';
        try {
          responseText = await apiResponse.text();
        } catch (e) {
          responseText = 'Failed to read response body';
        }

        this.results.push({
          layer: 'Worker API',
          status: 'FAIL',
          message: `API returned ${apiResponse.status} ${apiResponse.statusText}`,
          details: {
            status: apiResponse.status,
            statusText: apiResponse.statusText,
            responseText: responseText,
            testData
          }
        });
        await this.debugWorkerLogs('API endpoint failing');
        return;
      }

      let apiData;
      let responseText: string = '';
      try {
        responseText = await apiResponse.text();
        apiData = JSON.parse(responseText);
      } catch (parseError) {
        this.results.push({
          layer: 'Worker API',
          status: 'FAIL',
          message: `API returned invalid JSON: ${parseError.message}`,
          details: {
            status: apiResponse.status,
            statusText: apiResponse.statusText,
            responseText: responseText || 'Failed to read response text',
            parseError: parseError.message,
            testData
          }
        });
        await this.debugWorkerLogs('API returning invalid response');
        return;
      }

      if (!apiData.success) {
        this.results.push({
          layer: 'Worker API',
          status: 'FAIL',
          message: 'API returned success=false',
          details: { apiResponse: apiData, testData }
        });
        await this.debugWorkerLogs('API returning errors');
        return;
      }

      this.results.push({
        layer: 'Worker API',
        status: 'PASS',
        message: 'Worker API endpoints responding correctly',
        details: { health: healthData, apiTest: apiData }
      });

    } catch (error) {
      this.results.push({
        layer: 'Worker API',
        status: 'FAIL',
        message: `Worker API test failed: ${error.message}`,
        details: error
      });
      await this.debugWorkerLogs('API connection failed');
    }
  }

  private async testDurableObjects(): Promise<void> {
    console.log('🏗️ Testing Durable Objects...');

    // For now, if Worker API works, assume DO is working
    // In future, we could add specific DO health checks
    this.results.push({
      layer: 'Durable Objects',
      status: 'SKIP',
      message: 'Durable Objects test not implemented yet',
      details: { note: 'Worker API success implies DO is working' }
    });
  }

  private async testContainer(): Promise<void> {
    console.log('🐳 Testing Container...');

    // For now, if full pipeline works, assume container is working
    // In future, we could add container-specific health checks
    this.results.push({
      layer: 'Container',
      status: 'SKIP',
      message: 'Container test not implemented yet',
      details: { note: 'Full pipeline success implies container is working' }
    });
  }

  private async debugWorkerLogs(context: string): Promise<void> {
    console.log(`🔧 Debugging: ${context}`);
    console.log('   💡 To debug worker logs manually:');
    console.log(`      wrangler tail ralphwiggums-ralphwiggums-api-prod`);
    console.log('');

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      console.log('   ⚠️  CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN not set');
      console.log('      Set these environment variables to enable automatic log tailing');
      console.log('');
      return;
    }

    console.log('   📊 Attempting automatic worker log tailing...');

    try {
      // Start wrangler tail in background for 10 seconds
      const tailProcess = Bun.spawn([
        'wrangler', 'tail', 'ralphwiggums-ralphwiggums-api-prod',
        '--format', 'pretty'
      ], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          CLOUDFLARE_ACCOUNT_ID,
          CLOUDFLARE_API_TOKEN
        }
      });

      // Read logs for 10 seconds
      const timeout = setTimeout(() => {
        tailProcess.kill();
      }, 10000);

      const output = await new Response(tailProcess.stdout).text();
      const errorOutput = await new Response(tailProcess.stderr).text();

      clearTimeout(timeout);

      if (errorOutput) {
        console.log('   ❌ Worker log tailing failed:', errorOutput.trim());
      } else if (output) {
        console.log('   📋 Recent worker logs:');
        console.log(output.split('\n').slice(-5).join('\n'));
      } else {
        console.log('   🤷 No recent worker logs found');
      }

    } catch (error) {
      console.log('   ❌ Failed to tail worker logs:', error.message);
    }

    console.log('');
  }

  private printSummary(): void {
    console.log('📊 Test Summary');
    console.log('===============');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;

    console.log(`Total tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log('');

    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${icon} ${result.layer}: ${result.message}`);

      if (result.details && result.status === 'FAIL') {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });

    console.log('');
    if (failed > 0) {
      console.log('🔧 Next Steps:');
      console.log('1. Check the failing layer details above');
      console.log('2. Run manual log tailing commands shown during debugging');
      console.log('3. Ensure all required environment variables are set');
      console.log('4. Verify Cloudflare deployment is up to date');
      console.log('');
    }
  }

  private allTestsPass(): boolean {
    return this.results.every(r => r.status === 'PASS' || r.status === 'SKIP');
  }
}

// CLI interface
async function main() {
  const harness = new ProductionHarness();
  const success = await harness.runFullTest();

  if (!success) {
    console.log('❌ Production harness detected failures');
    process.exit(1);
  } else {
    console.log('✅ All production tests passed');
    process.exit(0);
  }
}

if (import.meta.main) {
  main().catch(error => {
    console.error('💥 Production harness crashed:', error);
    process.exit(1);
  });
}

export { ProductionHarness };