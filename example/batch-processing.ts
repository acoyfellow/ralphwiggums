/**
 * ralphwiggums Example: Batch Processing
 * 
 * Process multiple URLs or tasks efficiently with concurrency control,
 * progress tracking, and error handling.
 */

import { run } from "ralphwiggums";
import type { RalphOptions } from "ralphwiggums";

// ============================================================================
// Example 1: Sequential Processing
// ============================================================================

export async function processSequentially(
  urls: string[],
  task: string,
  options?: RalphOptions
) {
  const results = [];

  for (const url of urls) {
    console.log(`Processing ${url}...`);
    const result = await run(`Go to ${url} and ${task}`, options);
    results.push({ url, result });
  }

  return results;
}

// ============================================================================
// Example 2: Concurrent Processing with Limit
// ============================================================================

export async function processConcurrently(
  urls: string[],
  task: string,
  options?: RalphOptions,
  concurrency: number = 3
) {
  const results: Array<{ url: string; result: Awaited<ReturnType<typeof run>> }> = [];
  const errors: Array<{ url: string; error: string }> = [];

  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const result = await run(`Go to ${url} and ${task}`, options);
        return { url, result };
      })
    );

    batchResults.forEach((settled, index) => {
      if (settled.status === "fulfilled") {
        results.push(settled.value);
      } else {
        errors.push({
          url: batch[index],
          error: settled.reason?.message || "Unknown error",
        });
      }
    });

    console.log(`Processed ${Math.min(i + concurrency, urls.length)}/${urls.length}`);
  }

  return { results, errors };
}

// ============================================================================
// Example 3: Batch Extraction with Progress
// ============================================================================

export async function extractFromMultipleUrls(
  urls: string[],
  extractInstructions: string,
  options?: RalphOptions
) {
  const extracted: Array<{ url: string; data: unknown }> = [];
  const failed: Array<{ url: string; error: string }> = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const progress = `[${i + 1}/${urls.length}]`;

    try {
      console.log(`${progress} Extracting from ${url}...`);
      const result = await run(
        `Go to ${url} and ${extractInstructions}`,
        options
      );

      if (result.success) {
        extracted.push({ url, data: result.data });
        console.log(`${progress} ✅ Success`);
      } else {
        failed.push({ url, error: result.message });
        console.log(`${progress} ❌ Failed: ${result.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failed.push({ url, error: errorMessage });
      console.log(`${progress} ❌ Error: ${errorMessage}`);
    }
  }

  return { extracted, failed, total: urls.length };
}

// ============================================================================
// Example 4: Batch with Retry Logic
// ============================================================================

export async function processWithRetry(
  urls: string[],
  task: string,
  options?: RalphOptions,
  maxRetries: number = 2
) {
  const results: Array<{ url: string; result: Awaited<ReturnType<typeof run>>; attempts: number }> = [];
  const failed: Array<{ url: string; error: string }> = [];

  for (const url of urls) {
    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attempts = attempt + 1;
      try {
        const result = await run(`Go to ${url} and ${task}`, options);
        results.push({ url, result, attempts });
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying ${url} in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (lastError && attempts > maxRetries) {
      failed.push({
        url,
        error: lastError.message,
      });
    }
  }

  return { results, failed };
}

// ============================================================================
// Example 5: Batch Processing with Worker Pool Pattern
// ============================================================================

export async function processWithWorkerPool(
  tasks: Array<{ url: string; task: string }>,
  options?: RalphOptions,
  poolSize: number = 5
) {
  const results: Array<{ url: string; result: Awaited<ReturnType<typeof run>> }> = [];
  const queue = [...tasks];
  const workers: Promise<void>[] = [];

  // Create worker pool
  for (let i = 0; i < poolSize; i++) {
    const worker = (async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (!task) break;

        try {
          const result = await run(`Go to ${task.url} and ${task.task}`, options);
          results.push({ url: task.url, result });
        } catch (error) {
          console.error(`Failed to process ${task.url}:`, error);
        }
      }
    })();

    workers.push(worker);
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

// ============================================================================
// Usage Example
// ============================================================================

export async function exampleBatchExtraction() {
  const urls = [
    "https://example.com/product1",
    "https://example.com/product2",
    "https://example.com/product3",
  ];

  const { extracted, failed, total } = await extractFromMultipleUrls(
    urls,
    "extract: product name, price, and description",
    {
      maxIterations: 5,
      timeout: 60000,
    }
  );

  console.log(`\n✅ Extracted: ${extracted.length}/${total}`);
  console.log(`❌ Failed: ${failed.length}/${total}`);

  return { extracted, failed };
}
