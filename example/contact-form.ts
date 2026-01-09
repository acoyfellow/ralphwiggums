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
  const result = await run(`Fill out the contact form at ${url}:
    - Enter "${data.name}" in the name field
    - Enter "${data.email}" in the email field
    - Enter "${data.message}" in the message field
    - Click the submit button`, {
    maxIterations: 5,
    timeout: 60000,
  });

  return result;
}

// ============================================================================
// Example 2: Multi-Step Form
// ============================================================================

export async function completeMultiStepForm(url: string, formData: Record<string, string>) {
  const steps = Object.entries(formData).map(([field, value]) =>
    `Enter "${value}" in the ${field} field`
  ).join("\n");

  const result = await run(`Complete the multi-step form at ${url}:
    ${steps}
    - Proceed through each step
    - Submit the form`, {
    maxIterations: 10,
    timeout: 120000,
  });

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
// Main: Run Example
// ============================================================================

async function main() {
  console.log("RalphWiggums Example: Contact Form Automation\n");
  console.log("This example demonstrates how to automate form filling.");
  console.log("Note: Requires Cloudflare Workers with Container binding.\n");

  console.log("To run this example:");
  console.log("1. Deploy ralphwiggums to Cloudflare Workers");
  console.log("2. Set up a Container binding");
  console.log("3. Call the /do endpoint with your task");
  console.log("\nSee README.md for full documentation.");
}

main().catch(console.error);
