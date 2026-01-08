/**
 * ralphwiggums Example: Product Research & Comparison
 * 
 * This example demonstrates how to use ralphwiggums to research products,
 * extract pricing, features, and compare options across multiple pages.
 * 
 * Run: bun run example/product-research.ts
 */

import { run } from "ralphwiggums";
import { z } from "zod";

// ============================================================================
// Example 1: Extract Product Details
// ============================================================================

export async function extractProductDetails(url: string) {
  const ProductSchema = z.object({
    name: z.string().describe("product name"),
    price: z.string().describe("price with currency"),
    description: z.string().describe("product description"),
    features: z.array(z.string()).describe("key features"),
    rating: z.number().describe("star rating 0-5").optional(),
    inStock: z.boolean().describe("whether product is in stock"),
  });

  const result = await run(`Go to ${url} and extract all product information:
    - Product name
    - Price (including currency symbol)
    - Product description
    - Key features list
    - Star rating if shown
    - Stock availability status`, {
    maxIterations: 5,
    timeout: 60000,
  });

  return result;
}

// ============================================================================
// Example 2: Compare Multiple Products
// ============================================================================

export async function compareProducts(productUrls: string[]) {
  const ComparisonSchema = z.object({
    products: z.array(z.object({
      name: z.string(),
      price: z.string(),
      keyFeatures: z.array(z.string()),
      pros: z.array(z.string()).optional(),
      cons: z.array(z.string()).optional(),
    })),
    recommendation: z.string().describe("which product offers best value"),
  });

  const urls = productUrls.join("\n");
  const result = await run(`Compare products at these URLs:
${urls}

For each product, extract:
- Name and price
- Top 3 features
- Pros and cons if mentioned

Then provide a recommendation for best value.`, {
    maxIterations: 10,
    timeout: 120000,
  });

  return result;
}

// ============================================================================
// Example 3: Find Cheapest Price Across Retailers
// ============================================================================

export async function findCheapestPrice(productName: string, retailers: string[]) {
  const PriceSchema = z.object({
    products: z.array(z.object({
      retailer: z.string().describe("store name"),
      price: z.string().describe("price with currency"),
      url: z.string().describe("product page URL"),
      inStock: z.boolean(),
      shipping: z.string().describe("shipping cost").optional(),
    })),
    cheapest: z.object({
      retailer: z.string(),
      price: z.string(),
    }),
    savings: z.string().describe("how much saved vs most expensive"),
  });

  const sites = retailers.map(r => `${r}/search?q=${encodeURIComponent(productName)}`).join("\n");
  
  const result = await run(`Find the cheapest price for "${productName}" across these sites:
${sites}

For each retailer:
- Find the product page
- Extract the price
- Check if in stock
- Note shipping cost if shown

Return the cheapest option and calculate savings vs most expensive.`, {
    maxIterations: 15,
    timeout: 180000,
  });

  return result;
}

// ============================================================================
// Example 4: Extract Review Summary
// ============================================================================

export async function getReviewSummary(productUrl: string) {
  const ReviewSchema = z.object({
    overallRating: z.number().describe("average rating out of 5"),
    totalReviews: z.number().describe("total number of reviews"),
    pros: z.array(z.string()).describe("commonly mentioned pros"),
    cons: z.array(z.string()).describe("commonly mentioned cons"),
    summary: z.string().describe("2-3 sentence summary of customer sentiment"),
  });

  const result = await run(`Go to ${productUrl} and extract review information:
    - Overall average rating
    - Total number of reviews
    - Top 3 pros mentioned in reviews
    - Top 3 cons mentioned in reviews
    - Brief summary of customer sentiment`, {
    maxIterations: 5,
    timeout: 60000,
  });

  return result;
}

// ============================================================================
// Main: Run Example
// ============================================================================

async function main() {
  console.log("RalphWiggums Example: Product Research & Comparison\n");
  console.log("This example demonstrates how to automate product research.");
  console.log("Use cases:");
  console.log("  • Extract product specs and pricing");
  console.log("  • Compare features across competitors");
  console.log("  • Find cheapest prices across retailers");
  console.log("  • Summarize customer reviews\n");

  console.log("Usage:");
  console.log("  import { extractProductDetails, compareProducts } from './example/product-research.js'");
  console.log("  const result = await extractProductDetails('https://example.com/product');");
  console.log("  console.log(result.data); // { name: '...', price: '...', ... }\n");

  console.log("See README.md for full documentation.");
}

main().catch(console.error);
