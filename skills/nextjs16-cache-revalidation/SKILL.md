---
name: nextjs16-cache-revalidation
description: Guide for Next.js 16 cache invalidation strategy using updateTag, revalidateTag, and refresh correctly by consistency requirements and cache mode. Covers read-your-own-writes, stale-while-revalidate, uncached dynamic routes, and tag design. Activates when prompt mentions updateTag, revalidateTag, revalidatePath, refresh, cache invalidation, stale data, cache tags, data freshness, force-dynamic, no-store, or when implementing mutations that need to update cached data. Essential for keeping data fresh across multiple pages without over-invalidation. Complements nextjs-advanced-routing which covers revalidation basics — this skill provides the advanced tag-based strategy.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Next.js 16 Cache Revalidation Strategy

## Overview

This skill covers the correct cache invalidation strategy for Next.js 16 applications. The primary decision is **which invalidation API to use based on cache mode and consistency requirements**:

- **`updateTag(tag)`** — Immediate read-your-own-writes (Server Actions only)
- **`revalidateTag(tag, 'max')`** — Stale-while-revalidate (SWR) semantics
- **`refresh()`** / **`redirect()`** — For uncached (`force-dynamic` / `no-store`) data
- **`revalidatePath(path)`** — Broad route-level invalidation (secondary choice)

For basic revalidation patterns within Server Actions, see the **`nextjs-advanced-routing`** skill. This skill builds on those fundamentals with an advanced strategy.

## When to Use This Skill

Use this skill when:
- Implementing a Server Action that modifies data
- Deciding how to invalidate cached data after a mutation
- Designing cache tags for a new data resource
- Debugging stale data across multiple pages
- Choosing between `updateTag()`, `revalidateTag()`, `refresh()`, and `revalidatePath()`
- Working with `force-dynamic` or `no-store` routes that need post-mutation freshness
- Handling large payloads that may exceed cache size limits

## Invalidation Decision Matrix

Use this matrix to choose the correct API for every mutation:

| Scenario | API | Why |
|---|---|---|
| Server Action + user must immediately see their own write | `updateTag(tag)` | Immediate expiration/read-your-own-writes |
| Server Action/Route Handler + eventual consistency acceptable | `revalidateTag(tag, 'max')` | SWR semantics |
| Route Handler webhook invalidation requiring immediate expiration | `revalidateTag(tag, { expire: 0 })` | Immediate expiry outside Server Actions |
| `force-dynamic` / `cache: 'no-store'` data | `refresh()` or `redirect()` | No cache entry exists to invalidate by tag |
| Data payload exceeds cache entry size limits | Chunk data into cacheable units, or keep dynamic + `refresh()` | Oversized payloads are not cached |

## updateTag vs revalidateTag vs refresh

### `updateTag(tag)` — Immediate read-your-own-writes

- **Server Actions only** — cannot be called from Route Handlers or middleware
- Immediately expires the tagged cache entry so the next request gets fresh data
- The user who triggered the mutation sees their own write on the very next render
- Preferred for interactive mutations where the user expects to see their change immediately

### `revalidateTag(tag, 'max')` — Stale-while-revalidate (SWR)

- Marks the tagged cache entry as stale
- The next request still serves the stale data while revalidation happens in the background
- Subsequent requests get the fresh data
- Appropriate for webhooks, background jobs, or any mutation where eventual consistency is acceptable

### `refresh()` — Route payload refresh (no cache invalidation)

- `refresh()` refreshes the current route payload but does **not** invalidate tagged caches
- Use when the route fetches data with `force-dynamic` or `cache: 'no-store'` — there is no cache entry to invalidate by tag
- Also useful as a fallback when tag invalidation is not applicable

### `revalidatePath(path)` — Broad route-level invalidation

- Invalidates **everything** cached on a single route path
- Does not target specific data resources
- Use when data is truly isolated to one route, or for layout-level cache resets
- Secondary choice — prefer tag-based invalidation for shared data

## Deprecated API Usage

`revalidateTag(tag)` without a second argument is **deprecated** in Next.js 16. Always provide the second argument:

```typescript
// DEPRECATED — do not use in new code
revalidateTag('products')

// CORRECT — choose based on consistency needs:
updateTag('products')                    // Immediate (Server Actions only)
revalidateTag('products', 'max')         // SWR semantics
revalidateTag('products', { expire: 0 }) // Immediate (Route Handlers/webhooks)
```

## When Tags Do Nothing

Tag invalidation only affects cached entries. Data fetched with `cache: 'no-store'` or from routes using `force-dynamic` is **not cached**, so tag invalidation has no effect.

```typescript
// This fetch is NOT cached — tags will not help
async function getLiveDashboardData() {
  const res = await fetch(`${process.env.API_URL}/dashboard`, {
    cache: 'no-store',  // No cache entry created
    next: { tags: ['dashboard'] },  // Tag exists but has nothing to invalidate
  })
  return res.json()
}

// Calling updateTag('dashboard') or revalidateTag('dashboard', 'max')
// will have NO effect because the data was never cached.
```

For uncached routes, use `refresh()` or `redirect()` after mutation instead.

## 2MB Cache Entry Constraints

Both the Vercel Data Cache and the Next.js fetch cache have a **2MB per-entry size limit**. If a response or cached value exceeds this limit, it will **not be cached**, and tag invalidation will silently do nothing.

### Signs your data exceeds cache limits

- Tag invalidation appears to have no effect despite correct tagging
- Large collection endpoints (e.g., fetching all products) are always re-fetched
- Cache hit rates are unexpectedly low for specific endpoints

### Chunking strategy

Split oversized payloads into smaller, independently cacheable units:

```typescript
// WRONG — single large payload that may exceed 2MB
export const getAllProducts = unstable_cache(
  async () => {
    const res = await fetch(`${process.env.API_URL}/products`)  // 5000 products = >2MB
    return res.json()
  },
  ['all-products'],
  { tags: ['products'] }
)

// CORRECT — split into summary + paginated detail
export const getProductSummaries = unstable_cache(
  async (page: number) => {
    const res = await fetch(`${process.env.API_URL}/products?page=${page}&fields=id,name,price`)
    return res.json()
  },
  ['product-summaries', page.toString()],
  { tags: ['products', `products-page-${page}`] }
)

export const getProductDetail = unstable_cache(
  async (id: string) => {
    const res = await fetch(`${process.env.API_URL}/products/${id}`)
    return res.json()
  },
  ['product', id],
  { tags: ['products', `product-${id}`] }
)
```

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

Tag your cached fetch functions so invalidation APIs know what to target:

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

### Read-your-own-writes with updateTag (preferred for interactive mutations)

```ts
'use server'

import { updateTag } from 'next/cache'

export async function updateProduct(id: string, data: Partial<Product>) {
  await db.products.update({ where: { id }, data })

  // Read-your-own-writes for interactive mutation
  updateTag('products')
  updateTag(`product-${id}`)
}
```

### SWR revalidation (eventual consistency)

```ts
import { revalidateTag } from 'next/cache'

export async function webhookRevalidateProduct(id: string) {
  // Stale-while-revalidate — next request serves stale, background refreshes
  revalidateTag('products', 'max')
  revalidateTag(`product-${id}`, 'max')
}
```

### Uncached / force-dynamic route mutation

```ts
'use server'

import { refresh } from 'next/cache'

export async function updateLiveDashboardSettings(input: SettingsInput) {
  await db.settings.update({ data: input })

  // Route uses force-dynamic/no-store; tags do not apply
  refresh()
}
```

### Multiple related tags

When a mutation affects related data, invalidate all relevant tags:

```typescript
'use server'

import { updateTag } from 'next/cache'

export async function addItemToOrder(
  productId: string,
  orderId: string
) {
  await db.orderItems.create({
    data: { productId, orderId },
  })

  // The product's availability may have changed
  updateTag(`product-${productId}`)

  // The order's item list changed
  updateTag(`order-${orderId}`)

  // Collection-level tags for list views
  updateTag('products')
  updateTag('orders')
}
```

### With redirect after mutation

```typescript
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createOrder(formData: FormData) {
  const order = await db.orders.create({
    data: {
      customerName: formData.get('customerName') as string,
      items: formData.get('items') as string,
    },
  })

  updateTag('orders')
  redirect(`/orders/${order.id}`)
}
```

## Force-Dynamic + Large Payload Strategy

When a route uses `force-dynamic` and the payload is large (>2MB):

1. **Tag invalidation will not work** — data is not cached, and even if it were, it would exceed the 2MB limit
2. **Use `refresh()` or `redirect()`** after mutation to fetch fresh server data
3. **If tag invalidation is desired**, restructure into smaller cacheable units

### Migration checklist

1. Split single huge payload into summary + paginated/detail endpoints
2. Tag summary, list, and detail independently
3. Use `updateTag` for post-mutation read-your-own-writes on each unit
4. Keep truly live data uncached and refresh the route after mutation

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
  updateTag('products')
  updateTag(`product-${id}`)
}
```

### Anti-Pattern 2: Using single-arg revalidateTag (deprecated)

```typescript
// WRONG — deprecated single-argument form
export async function updateProduct(id: string, data: Partial<Product>) {
  await db.products.update({ where: { id }, data })
  revalidateTag('products')       // Deprecated — no second argument
  revalidateTag(`product-${id}`)  // Deprecated
}
```

```typescript
// CORRECT — use updateTag for immediate consistency in Server Actions
export async function updateProduct(id: string, data: Partial<Product>) {
  await db.products.update({ where: { id }, data })
  updateTag('products')
  updateTag(`product-${id}`)
}
```

### Anti-Pattern 3: Forgetting to tag fetches

```typescript
// WRONG — no tags means invalidation APIs have nothing to target
async function getProducts() {
  const res = await fetch(`${process.env.API_URL}/products`)
  return res.json()
}
```

```typescript
// CORRECT — tagged so updateTag('products') or revalidateTag('products', 'max') works
async function getProducts() {
  const res = await fetch(`${process.env.API_URL}/products`, {
    next: { tags: ['products'] },
  })
  return res.json()
}
```

### Anti-Pattern 4: Tag invalidation on uncached data

```typescript
// WRONG — data is fetched with no-store, so tags have no effect
export async function updateDashboard(data: DashboardInput) {
  await db.dashboard.update({ data })
  updateTag('dashboard')  // Pointless — no cache entry exists
}
```

```typescript
// CORRECT — use refresh() for uncached dynamic routes
export async function updateDashboard(data: DashboardInput) {
  await db.dashboard.update({ data })
  refresh()  // Refreshes the route payload
}
```

### Anti-Pattern 5: Claiming optimistic UI alone guarantees data correctness

```typescript
// WRONG — optimistic UI without server-side freshness
const handleRemove = async (itemId: string) => {
  removeOptimistic(itemId)
  await removeItem(itemId)
  // No server-side cache invalidation — stale data persists
}
```

```typescript
// CORRECT — optimistic UI paired with server invalidation
// The Server Action (removeItem) must call updateTag() or refresh() internally
const handleRemove = async (itemId: string) => {
  removeOptimistic(itemId)
  await removeItem(itemId)  // Server Action calls updateTag('items') internally
}
```

## Consistent Wording Reference

Use these descriptions across skills for consistency:

- "`refresh()` refreshes the current route payload but does not invalidate tagged caches."
- "`updateTag()` is Server Actions-only and is preferred for immediate read-your-own-writes."
- "`revalidateTag(tag, 'max')` marks data stale for stale-while-revalidate behavior."
- "`revalidateTag(tag)` without a second argument is deprecated."
- "Tag invalidation only affects cached entries. Data fetched with `no-store` cannot be tag-revalidated."

## Summary

- Choose invalidation API based on cache mode and consistency needs — see the decision matrix above
- `updateTag()` for immediate read-your-own-writes in Server Actions (preferred for interactive mutations)
- `revalidateTag(tag, 'max')` for SWR/eventual consistency (webhooks, background jobs)
- `refresh()` or `redirect()` for uncached `force-dynamic`/`no-store` routes
- `revalidatePath()` for broad route-level resets when data is isolated to one route
- `revalidateTag(tag)` single-arg form is deprecated — always provide a second argument
- Tag invalidation only works on cached data — uncached routes need `refresh()`
- Cache entries are limited to 2MB — chunk large payloads into smaller tagged units
- Tag every cached fetch with descriptive, hierarchical tags
- Design tags around data resources, not routes
- See **`nextjs16-server-data-architecture`** for the overall data flow philosophy
- See **`nextjs16-use-hook-data-flow`** for optimistic UI + server invalidation patterns
