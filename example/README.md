# ralphwiggums Examples

This folder contains examples demonstrating how to use ralphwiggums for web automation.

## Examples

| Example | Description |
|---------|-------------|
| [product-research.ts](./product-research.ts) | Extract and compare product data from e-commerce sites |
| [contact-form.ts](./contact-form.ts) | Automate filling out contact forms |

## Featured: Product Research

Automate product discovery and comparison across websites:

```typescript
import { run } from "ralphwiggums";

const result = await run(
  "Go to https://example.com/product and extract: product name, price, features, and rating"
);

console.log(result.data);
// "MacBook Pro - $1,999 - Features: [...], Rating: 4.8"
```

**Note**: These examples require a container server running (see main README for setup instructions).

## Quick Start

```bash
# Install dependencies
bun install

# Run an example
bun run example/product-research.ts
```
