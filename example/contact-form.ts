/**
 * ralphwiggums Example: Contact Form Automation
 * 
 * This example demonstrates how to use ralphwiggums to automate
 * filling out a contact form on any website.
 * 
 * Run: bun run example/contact-form.ts
 */

import { run } from "ralphwiggums";
import type { RalphOptions } from "ralphwiggums";

// ============================================================================
// Example 1: Simple Contact Form
// ============================================================================

export async function fillContactForm(url: string, data: { name: string; email: string; message: string }) {
  // Type your options for better IDE autocomplete and type safety
  const options: RalphOptions = {
    maxIterations: 5,
    timeout: 60000,
  };

  const result = await run(`Fill out the contact form at ${url}:
    - Enter "${data.name}" in the name field
    - Enter "${data.email}" in the email field
    - Enter "${data.message}" in the message field
    - Click the submit button`, options);

  return result;
}

// ============================================================================
// Example 2: Multi-Step Form
// ============================================================================

export async function completeMultiStepForm(url: string, formData: Record<string, string>) {
  const steps = Object.entries(formData).map(([field, value]) =>
    `Enter "${value}" in the ${field} field`
  ).join("\n");

  // You can also type options inline or pass them directly
  const result = await run(`Complete the multi-step form at ${url}:
    ${steps}
    - Proceed through each step
    - Submit the form`, {
    maxIterations: 10,
    timeout: 120000,
  } satisfies RalphOptions);

  return result;
}

// ============================================================================
// Example 3: Form with Checkpoints
// ============================================================================

export async function fillFormWithProgress(url: string, data: Record<string, string>) {
  const instructions = Object.entries(data).map(([field, value]) =>
    `Fill the ${field} with "${value}"`
  ).join(". ");

  const result = await run(`${instructions}. Submit the form and wait for confirmation.`, {
    maxIterations: 8,
    timeout: 90000,
  });

  return result;
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
To run this example:
1. Deploy ralphwiggums to Cloudflare Workers
2. Set up a Container binding
3. Call the /do endpoint with your task

Example API call:
POST /api/contact-form
{
  "url": "https://example.com/contact",
  "data": { "name": "John Doe", "email": "john@example.com", "message": "Hello!" }
}
*/
