---
name: nextjs16-server-data-architecture
description: Core architectural philosophy for Next.js 16 + React 19 server-rendered applications. CRITICAL for understanding the Server-Authoritative Data Model. Activates when prompt mentions data fetching strategy, useEffect for refetching, client-side data loading, SWR, React Query, or architectural decisions about where data should be fetched. Essential for enforcing the rule that all authoritative data flows through Server Components and Server Actions — never through client-side refetch logic. See also nextjs16-cache-revalidation, nextjs16-use-hook-data-flow, and nextjs16-page-level-suspense for complementary patterns.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Next.js 16 + React 19: Server-Authoritative Data Architecture

## Overview

The **Server-Authoritative Data Model** is an architectural pattern for Next.js 16 + React 19 applications where all data fetching, mutations, and cache invalidation are handled on the server. There is no client-side refetch logic using `useEffect`, SWR, React Query, or any other client-side data fetching library.

This skill defines the philosophy. For implementation details, see:
- **`nextjs16-use-hook-data-flow`** — the `use()` hook pattern for passing data from Server to Client Components
- **`nextjs16-cache-revalidation`** — tag-based cache invalidation strategy
- **`nextjs16-page-level-suspense`** — holistic page-level loading states

## Core Philosophy

### The data flow is always:

1. **Data is fetched in Server Components** (or via cached server functions)
2. **Data is passed to Client Components as a Promise**
3. **Client Components call `use()` to unwrap the Promise**
4. **Suspense handles loading states**
5. **Mutations happen via Server Actions**
6. **Fresh data is triggered via `revalidateTag()`**
7. **Optimistic cache updates provide immediate UI feedback**

### What this architecture avoids:

- No `useEffect` for data fetching or refetching
- No `useState` + `fetch()` patterns for loading data
- No SWR or React Query for server data
- No polling intervals for data freshness
- No manual cache management on the client

## When to Use This Skill

Use this skill when:
- Deciding where to fetch data (server vs client)
- Reviewing code that introduces `useEffect` for data loading
- Planning a new feature's data flow
- Debugging stale data issues
- Choosing between client-side and server-side mutation patterns

## The Server-Authoritative Pattern

### How data gets to the UI

```tsx
// 1. Server Component fetches data (page.tsx)
import { getProducts } from '@/actions/get-products'
import ProductList from './ProductList'
import { Suspense } from 'react'

export default function Page() {
  // Create promise — do NOT await here
  const productsPromise = getProducts()

  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <ProductList productsPromise={productsPromise} />
    </Suspense>
  )
}
```

```tsx
// 2. Client Component unwraps the promise with use()
'use client'

import { use } from 'react'
import type { Product } from '@/types'

export default function ProductList({
  productsPromise,
}: {
  productsPromise: Promise<Product[]>
}) {
  const products = use(productsPromise)

  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

```tsx
// 3. Server Action handles mutations
'use server'

import { revalidateTag } from 'next/cache'

export async function updateProduct(id: string, data: Partial<Product>) {
  await db.products.update({ where: { id }, data })

  // Revalidate the tag — fresh data flows automatically
  revalidateTag('products')
}
```

### How data gets refreshed

After a mutation, the cycle is:

```
User action → Server Action → Database write → revalidateTag()
→ Next.js refetches tagged data → Server Component re-renders
→ New promise passed to Client Component → use() unwraps fresh data
```

The client never polls, refetches, or manages staleness. The server is the single source of truth.

## Anti-Patterns — What NOT to Do

### Anti-Pattern 1: useEffect data fetching

```tsx
// WRONG
'use client'

import { useState, useEffect } from 'react'

export default function ProductList() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading...</div>
  return <ul>{products.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

**Why it's wrong:** Duplicates server capabilities on the client, adds loading state management, creates waterfall fetches, increases bundle size, and bypasses the cache revalidation system.

### Anti-Pattern 2: Client-side refetch after mutation

```tsx
// WRONG
'use client'

import { useState } from 'react'

export default function ProductForm({ productId }: { productId: string }) {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSave = async () => {
    await fetch(`/api/products/${productId}`, { method: 'PUT', body: '...' })
    setRefreshKey((k) => k + 1) // Forces re-render to "refresh" data
  }

  // ...
}
```

**Why it's wrong:** The correct approach is to call a Server Action that writes to the database and calls `revalidateTag()`. The server handles freshness, not the client.

### Anti-Pattern 3: SWR / React Query for server data

```tsx
// WRONG — do not use client-side fetching libraries for server data
'use client'

import useSWR from 'swr'

export default function OrderList() {
  const { data, isLoading } = useSWR('/api/orders', fetcher)
  // ...
}
```

**Why it's wrong:** These tools are designed for client-first architectures. This architecture is server-first. Data freshness is managed via `revalidateTag()`, not client-side polling or revalidation.

## When Client-Side State IS Appropriate

Client-side state management (`useState`, `useReducer`) is correct for:

- **UI state:** open/closed modals, active tabs, form input values
- **Optimistic updates:** temporary UI feedback before server confirmation
- **Derived/filtered views:** sorting or filtering data already fetched by the server
- **Ephemeral state:** drag positions, scroll offsets, animation state

The rule is: **if the data originates from the server, it flows through Server Components. If the state is purely a UI concern, it lives in Client Components.**

## Architecture Diagram

```
Server Component (page.tsx)
  │
  ├─ Calls cached fetch function (tagged with cache tags)
  │   └─ Returns a Promise (NOT awaited in the page)
  │
  ├─ Wraps Client Component in <Suspense>
  │
  └─ Passes Promise as prop to Client Component
       │
       Client Component ('use client')
         │
         ├─ Calls use(promise) to unwrap data
         ├─ Renders UI with resolved data
         └─ Calls Server Actions for mutations
              │
              Server Action ('use server')
                ├─ Writes to database
                └─ Calls revalidateTag() → triggers fresh server fetch
```

## Summary

- Server Components own data fetching
- Client Components own interactivity
- `use()` bridges the two via Promises
- `revalidateTag()` keeps data fresh
- No `useEffect` for data. Ever.
