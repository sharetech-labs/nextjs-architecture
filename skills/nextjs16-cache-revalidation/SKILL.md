---
name: nextjs16-cache-revalidation
description: Guide for tag-based cache revalidation with revalidateTag() in Next.js 16. CRITICAL for understanding why revalidateTag() is preferred over revalidatePath() for applications with shared data across routes. Activates when prompt mentions revalidateTag, revalidatePath, cache invalidation, stale data, cache tags, data freshness, or when implementing mutations that need to update cached data. Essential for keeping data fresh across multiple pages without over-invalidation. Complements nextjs-advanced-routing which covers revalidation basics — this skill provides the advanced tag-based strategy.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Next.js 16 Cache Revalidation with Tags

## Overview

This skill recommends **`revalidateTag()`** as the primary cache invalidation strategy for Next.js 16 applications where data is shared across multiple routes. It explains when `revalidateTag()` is superior to `revalidatePath()`, how to design an effective tagging strategy, and when `revalidatePath()` is still the right choice.

For basic revalidation patterns within Server Actions, see the **`nextjs-advanced-routing`** skill. This skill builds on those fundamentals with an advanced tag-based strategy.

## When to Use This Skill

Use this skill when:
- Implementing a Server Action that modifies data
- Deciding how to invalidate cached data after a mutation
- Designing cache tags for a new data resource
- Debugging stale data across multiple pages
- Choosing between `revalidateTag()` and `revalidatePath()`

## revalidateTag() vs revalidatePath() — When to Use Which

### revalidateTag() — Granular, resource-level invalidation

Revalidates specific data resources **across the entire app**, regardless of which routes use that data.

**Choose `revalidateTag()` when:**
- The same data appears on multiple pages (e.g., a user profile shown in the header, dashboard, and settings)
- Multiple components across different routes consume the same API response
- You want to invalidate only the data that changed, not everything on a route
- Your application has shared, cross-cutting data resources

### revalidatePath() — Broad, route-level invalidation

Revalidates **everything** tied to a single path. Every cached fetch on that route is invalidated, even data that didn't change.

**Choose `revalidatePath()` when:**
- Data is truly isolated to one route and nowhere else
- You need a layout-level cache bust (e.g., after a theme or locale change)
- During development or debugging when you need a broad reset
- The route has a single data source with no sharing concerns

### Why tags are preferred for most applications

In most non-trivial applications, data is:

- **Shared across multiple pages** — product data appears on listings, detail pages, carts, and recommendations
- **Rendered in multiple components** — the same user data feeds navigation, profile sections, and activity feeds
- **Not isolated to one route** — updating a product's price affects every page that displays it

Using `revalidateTag()`:
- Refreshes the resource **everywhere** it appears
- Avoids unnecessary re-renders of unrelated data on the same route
- Keeps caching efficient by targeting only what changed
- Prevents over-invalidation that degrades performance

Using `revalidatePath()` in this scenario would:
- Only refresh data on one route, leaving stale data on other routes
- Invalidate ALL cached data on that route, not just what changed
- Require listing every affected path when data is shared

## Cache Tag Design

### Naming Convention

Use descriptive, hierarchical tag names:

```typescript
// Resource-level tags (most common)
'products'            // All product data
'users'               // All user data
'orders'              // All order data
'user-profile'        // Current user's profile

// Instance-level tags (for targeted invalidation)
'product-123'         // Specific product
'user-456'            // Specific user
'order-789'           // Specific order

// Relationship tags (for connected data)
'user-456-orders'     // Orders belonging to a specific user
'category-electronics-products'  // Products in a category
```

### Tagging Fetch Functions

Tag your cached fetch functions so `revalidateTag()` knows what to invalidate:

```typescript
// actions/get-products.ts
import { unstable_cache } from 'next/cache'

export const getProducts = unstable_cache(
  async () => {
    const res = await fetch(`${process.env.API_URL}/products`)
    return res.json()
  },
  ['products'],            // Cache key
  { tags: ['products'] }   // Cache tags for revalidation
)

export const getProduct = unstable_cache(
  async (id: string) => {
    const res = await fetch(`${process.env.API_URL}/products/${id}`)
    return res.json()
  },
  ['product', id],
  {
    tags: ['products', `product-${id}`]  // Both collection and instance tags
  }
)
```

### Using fetch() with tags (Next.js native)

```typescript
// Direct fetch with tags
async function getUsers() {
  const res = await fetch(`${process.env.API_URL}/users`, {
    next: { tags: ['users'] },
  })
  return res.json()
}

async function getUser(id: string) {
  const res = await fetch(`${process.env.API_URL}/users/${id}`, {
    next: { tags: ['users', `user-${id}`] },
  })
  return res.json()
}
```

## Revalidation in Server Actions

### Basic pattern

```typescript
'use server'

import { revalidateTag } from 'next/cache'

export async function updateProduct(id: string, data: Partial<Product>) {
  await db.products.update({ where: { id }, data })

  // Revalidate both the collection and the specific instance
  revalidateTag('products')
  revalidateTag(`product-${id}`)
}
```

### Multiple related tags

When a mutation affects related data, revalidate all relevant tags:

```typescript
'use server'

import { revalidateTag } from 'next/cache'

export async function addItemToOrder(
  productId: string,
  orderId: string
) {
  await db.orderItems.create({
    data: { productId, orderId },
  })

  // The product's availability may have changed
  revalidateTag(`product-${productId}`)

  // The order's item list changed
  revalidateTag(`order-${orderId}`)

  // Collection-level tags for list views
  revalidateTag('products')
  revalidateTag('orders')
}
```

### With redirect after mutation

```typescript
'use server'

import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createOrder(formData: FormData) {
  const order = await db.orders.create({
    data: {
      customerName: formData.get('customerName') as string,
      items: formData.get('items') as string,
    },
  })

  revalidateTag('orders')
  redirect(`/orders/${order.id}`)
}
```

## Designing a Tag Strategy for Your Application

Use this template to plan cache tags for your data model:

| Domain | Collection Tag | Instance Tag | Relationship Tags |
|--------|---------------|-------------|-------------------|
| Products | `products` | `product-{id}` | `category-{slug}-products` |
| Users | `users` | `user-{id}` | `team-{id}-users` |
| Orders | `orders` | `order-{id}` | `user-{id}-orders` |
| Categories | `categories` | `category-{slug}` | — |
| Settings | `settings` | `setting-{key}` | — |

**Guidelines for designing your own tags:**
- Start with **collection** and **instance** tags for each data model
- Add **relationship tags** when entities are frequently queried together
- Keep tag names readable — they should describe the data, not the route
- Prefer plural nouns for collections (`products`, not `product-list`)

## Anti-Patterns

### Anti-Pattern 1: Using revalidatePath() for shared data

```typescript
// WRONG — only refreshes data on /dashboard, leaves /products stale
export async function updateProduct(id: string, data: Partial<Product>) {
  await db.products.update({ where: { id }, data })
  revalidatePath('/dashboard')     // Product data on /products is still stale
  revalidatePath('/products')      // Have to list every route manually
  revalidatePath('/categories/electronics')  // Easy to miss routes
}
```

```typescript
// CORRECT — refreshes product data everywhere it's used
export async function updateProduct(id: string, data: Partial<Product>) {
  await db.products.update({ where: { id }, data })
  revalidateTag('products')
  revalidateTag(`product-${id}`)
}
```

### Anti-Pattern 2: Forgetting to tag fetches

```typescript
// WRONG — no tags means revalidateTag() has nothing to target
async function getProducts() {
  const res = await fetch(`${process.env.API_URL}/products`)
  return res.json()
}
```

```typescript
// CORRECT — tagged so revalidateTag('products') works
async function getProducts() {
  const res = await fetch(`${process.env.API_URL}/products`, {
    next: { tags: ['products'] },
  })
  return res.json()
}
```

### Anti-Pattern 3: Over-revalidating with broad tags only

```typescript
// INEFFICIENT — revalidates ALL products when only one changed
export async function updateProductName(id: string, name: string) {
  await db.products.update({ where: { id }, data: { name } })
  revalidateTag('products')  // Every product fetch re-runs
}
```

```typescript
// BETTER — use instance tag for targeted invalidation
export async function updateProductName(id: string, name: string) {
  await db.products.update({ where: { id }, data: { name } })
  revalidateTag(`product-${id}`)  // Only this product's data refreshes
  revalidateTag('products')        // List views also refresh
}
```

## Summary

- Prefer `revalidateTag()` when data is shared across routes (most applications)
- Use `revalidatePath()` when data is isolated to one route or for layout-level resets
- Tag every cached fetch with descriptive, hierarchical tags
- Revalidate both instance and collection tags after mutations
- Design tags around data resources, not routes
