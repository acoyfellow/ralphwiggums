# ralphwiggums Examples

Complete examples demonstrating different use cases for ralphwiggums web automation.

## Examples

| Example | Description | Use Case |
|---------|-------------|----------|
| [cli-basic.ts](./cli-basic.ts) | Simple CLI scripts for quick tasks | One-off automation, testing, scripts |
| [worker-endpoint.ts](./worker-endpoint.ts) | Cloudflare Worker production setup | Production APIs, serverless automation |
| [error-handling.ts](./error-handling.ts) | Production error handling patterns | Robust error handling, retries, recovery |
| [batch-processing.ts](./batch-processing.ts) | Process multiple URLs efficiently | Bulk operations, data collection |
| [ci-cd-task.ts](./ci-cd-task.ts) | CI/CD pipeline integration | Automated testing, monitoring, validation |
| [contact-form.ts](./contact-form.ts) | Form automation patterns | Form filling, multi-step forms |
| [product-research.ts](./product-research.ts) | Data extraction and comparison | E-commerce, price comparison, research |

## Quick Start

```bash
# Install dependencies
bun install

# Run an example
bun run example/cli-basic.ts "Go to example.com and get the title"
```

## Example Categories

### 1. CLI Usage (`cli-basic.ts`)
Simple standalone scripts perfect for quick tasks and testing:

```typescript
import { run } from "ralphwiggums";

const result = await run("Go to example.com and get the page title");
console.log(result.data);
```

**Run:** `bun run example/cli-basic.ts "your task here"`

### 2. Cloudflare Worker (`worker-endpoint.ts`)
Production-ready Worker setup with authentication, CORS, and error handling:

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prompt, options } = await request.json();
    const result = await run(prompt, options);
    return Response.json(result);
  }
};
```

**Deploy:** `bun run deploy`

### 3. Error Handling (`error-handling.ts`)
Handle all error types with retries, checkpoints, and proper error responses:

```typescript
import { MaxIterationsError, TimeoutError } from "ralphwiggums";

try {
  const result = await run(prompt, options);
} catch (error) {
  if (error instanceof TimeoutError) {
    // Handle timeout
  }
}
```

### 4. Batch Processing (`batch-processing.ts`)
Process multiple URLs with concurrency control and progress tracking:

```typescript
const { extracted, failed } = await extractFromMultipleUrls(
  urls,
  "extract: name, price, description"
);
```

### 5. CI/CD Integration (`ci-cd-task.ts` + `.github/workflows/automation.yml`)
Automate tasks in GitHub Actions for testing, monitoring, or data collection:

```yaml
- name: Run automation
  env:
    ZEN_API_KEY: ${{ secrets.ZEN_API_KEY }}
  run: bun run example/ci-cd-task.ts
```

**Setup:** Add `ZEN_API_KEY` to GitHub Secrets

### 6. Form Automation (`contact-form.ts`)
Automate form filling with type-safe options:

```typescript
import type { RalphOptions } from "ralphwiggums";

const options: RalphOptions = {
  maxIterations: 5,
  timeout: 60000,
};

const result = await run("Fill contact form...", options);
```

### 7. Data Extraction (`product-research.ts`)
Extract and compare data across multiple pages:

```typescript
const result = await extractProductDetails("https://example.com/product");
// Returns: { name, price, description, features, rating }
```

## Requirements

All examples require:
- **Container server running** (see main README for setup)
- **ZEN_API_KEY** environment variable set
- **Bun** installed

For local development:
```bash
# Terminal 1: Container server
source .env
PORT=8081 bun run --hot container/server.ts

# Terminal 2: Run example
bun run example/cli-basic.ts
```
