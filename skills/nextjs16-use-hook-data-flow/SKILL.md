---
name: nextjs16-use-hook-data-flow
description: Guide for the React 19 use() hook data flow pattern in Next.js 16. CRITICAL for passing Promises from Server Components to Client Components, unwrapping data with use(), and integrating with Suspense for loading states. Activates when prompt mentions use() hook, passing promises as props, promise unwrapping, Server-to-Client data handoff, Suspense data loading, or optimistic cache updates with useOptimistic. Essential for implementing the Server Component → Promise → Client Component pattern. Builds on nextjs-server-client-components with the streaming-first approach. See nextjs16-page-level-suspense for holistic loading strategy.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# React 19 use() Hook Data Flow in Next.js 16

## Overview

This skill covers a streaming-first data flow pattern for Next.js 16 + React 19: Server Components create Promises from cached fetches and pass them as props to Client Components, which unwrap them with React 19's `use()` hook inside Suspense boundaries. This enables streaming, parallel data loading, and clean separation of server and client concerns.

For foundational Server vs Client Component guidance, see **`nextjs-server-client-components`**. This skill builds on that with the `use()` hook streaming pattern.

For choosing between per-section and page-level Suspense strategies, see **`nextjs16-page-level-suspense`**.

## When to Use This Skill

Use this skill when:
- Passing data from a Server Component to a Client Component
- Implementing a new page or feature that displays server data
- Adding Suspense loading states to data-dependent UI
- Using `use()` to unwrap promises in Client Components
- Implementing optimistic updates with `useOptimistic`
- Debugging issues with promise handling or Suspense boundaries

## The Core Pattern

### Step 1: Server Component creates a Promise (does NOT await)

```tsx
// app/products/page.tsx
import { getProducts } from '@/actions/get-products'
import ProductsClient from './ProductsClient'
import { Suspense } from 'react'

export default function Page() {
  // Create the promise — do NOT await it
  const productsPromise = getProducts()

  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductsClient productsPromise={productsPromise} />
    </Suspense>
  )
}
```

**Key points:**
- The fetch function is called but NOT awaited
- The raw Promise is passed as a prop
- Suspense wraps the Client Component to handle the loading state
- The Server Component itself renders instantly (no blocking)

### Step 2: Client Component unwraps with use()

```tsx
// app/products/ProductsClient.tsx
'use client'

import { use } from 'react'
import type { Product } from '@/types'

export default function ProductsClient({
  productsPromise,
}: {
  productsPromise: Promise<Product[]>
}) {
  // use() suspends until the promise resolves
  const products = use(productsPromise)

  return (
    <div>
      {products.map((product) => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>${product.price}</p>
        </div>
      ))}
    </div>
  )
}
```

**Key points:**
- `use()` suspends the component until the Promise resolves
- While suspended, the Suspense fallback is shown
- Once resolved, the component renders with the data
- No `useEffect`, no `useState`, no loading booleans

### Step 3: Skeleton component for the loading state

```tsx
// app/products/ProductsSkeleton.tsx
export default function ProductsSkeleton() {
  return (
    <div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
      ))}
    </div>
  )
}
```

## Multiple Promises — Two Approaches

When a page needs multiple data sources, you have two strategies. Choose based on UX goals.

### Option A: Per-section Suspense (progressive loading)

Each section streams in independently — the fastest resolves first:

```tsx
// app/dashboard/page.tsx
import { getProducts } from '@/actions/get-products'
import { getOrders } from '@/actions/get-orders'
import { getStats } from '@/actions/get-stats'
import { Suspense } from 'react'

export default function Page() {
  const productsPromise = getProducts()
  const ordersPromise = getOrders()
  const statsPromise = getStats()

  return (
    <div className="grid grid-cols-3 gap-4">
      <Suspense fallback={<StatsSkeleton />}>
        <StatsPanel statsPromise={statsPromise} />
      </Suspense>

      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsPanel productsPromise={productsPromise} />
      </Suspense>

      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersPanel ordersPromise={ordersPromise} />
      </Suspense>
    </div>
  )
}
```

**Best for:** Pages where sections are independent and the user benefits from seeing partial data early.

### Option B: Page-level Suspense (all-at-once loading)

All promises are passed to one Client Component. The page renders when ALL data is ready:

```tsx
// app/dashboard/page.tsx
import { getProducts } from '@/actions/get-products'
import { getOrders } from '@/actions/get-orders'
import { getStats } from '@/actions/get-stats'
import DashboardClient from './DashboardClient'

export default function Page() {
  const productsPromise = getProducts()
  const ordersPromise = getOrders()
  const statsPromise = getStats()

  return (
    <DashboardClient
      productsPromise={productsPromise}
      ordersPromise={ordersPromise}
      statsPromise={statsPromise}
    />
  )
}
// + loading.tsx provides the holistic skeleton
```

**Best for:** Pages where sections are visually connected and the user benefits from seeing the complete page at once. See **`nextjs16-page-level-suspense`** for the full pattern.

## Combining use() with Interactive State

Client Components can mix server data (via `use()`) with local UI state:

```tsx
'use client'

import { use, useState } from 'react'
import type { Product } from '@/types'

export default function ProductList({
  productsPromise,
}: {
  productsPromise: Promise<Product[]>
}) {
  const products = use(productsPromise)
  const [filter, setFilter] = useState('')

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter products..."
      />
      <ul>
        {filtered.map((p) => (
          <li key={p.id}>{p.name} — ${p.price}</li>
        ))}
      </ul>
    </div>
  )
}
```

The data comes from the server via `use()`. The filter is purely local UI state. No useEffect needed.

## Optimistic Updates with useOptimistic

For mutations that should show immediate feedback before the server confirms:

```tsx
'use client'

import { use, useOptimistic } from 'react'
import { removeItem } from '@/actions/remove-item'
import type { Item } from '@/types'

export default function ItemList({
  itemsPromise,
  listId,
}: {
  itemsPromise: Promise<Item[]>
  listId: string
}) {
  const items = use(itemsPromise)

  const [optimisticItems, removeOptimistic] = useOptimistic(
    items,
    (state, removedId: string) => state.filter((item) => item.id !== removedId)
  )

  const handleRemove = async (itemId: string) => {
    // Immediately update UI
    removeOptimistic(itemId)

    // Server Action writes to DB + calls revalidateTag()
    await removeItem(itemId, listId)
    // After revalidation, the Server Component re-renders with fresh data
  }

  return (
    <ul>
      {optimisticItems.map((item) => (
        <li key={item.id}>
          {item.name}
          <button onClick={() => handleRemove(item.id)}>Remove</button>
        </li>
      ))}
    </ul>
  )
}
```

The flow:
1. `useOptimistic` removes the item from the UI instantly
2. Server Action writes to the database and calls `revalidateTag()`
3. Next.js refetches the tagged data on the server
4. Server Component re-renders with the authoritative fresh data
5. The optimistic state is replaced by the real server state

## Typing Promises Correctly

Always use specific types for promise props:

```tsx
// CORRECT — specific type
interface ProductListProps {
  productsPromise: Promise<Product[]>
}

// CORRECT — generic for reusable components
interface DataDisplayProps<T> {
  dataPromise: Promise<T>
}

// WRONG — never use any
interface BadProps {
  dataPromise: Promise<any>  // TypeScript will reject this with no-explicit-any
}
```

## Nested Suspense Boundaries

Use nested boundaries for progressive loading when sections have different data speeds:

```tsx
// app/users/[id]/page.tsx
import { getUser } from '@/actions/get-user'
import { getUserOrders } from '@/actions/get-user-orders'
import { getUserActivity } from '@/actions/get-user-activity'
import { Suspense } from 'react'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Fast fetch
  const userPromise = getUser(id)
  // Slower fetches
  const ordersPromise = getUserOrders(id)
  const activityPromise = getUserActivity(id)

  return (
    <div>
      {/* User header loads first */}
      <Suspense fallback={<HeaderSkeleton />}>
        <UserHeader userPromise={userPromise} />
      </Suspense>

      {/* Tabs load independently */}
      <div className="grid grid-cols-2 gap-4">
        <Suspense fallback={<OrdersSkeleton />}>
          <OrdersTab ordersPromise={ordersPromise} />
        </Suspense>

        <Suspense fallback={<ActivitySkeleton />}>
          <ActivityTab activityPromise={activityPromise} />
        </Suspense>
      </div>
    </div>
  )
}
```

## Anti-Patterns

### Anti-Pattern 1: Awaiting in the Server Component then passing resolved data

```tsx
// LESS OPTIMAL — blocks the Server Component until data resolves
export default async function Page() {
  const products = await getProducts()  // Blocks here

  return <ProductList products={products} />
}
```

```tsx
// BETTER — streams via Suspense, Server Component renders instantly
export default function Page() {
  const productsPromise = getProducts()  // No await, no blocking

  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductList productsPromise={productsPromise} />
    </Suspense>
  )
}
```

**Why:** Awaiting in the Server Component blocks the entire page from rendering until the data arrives. Passing a Promise with Suspense allows the shell to render immediately and the data to stream in.

### Anti-Pattern 2: Missing Suspense boundary

```tsx
// WRONG — use() will throw without a Suspense boundary
export default function Page() {
  const productsPromise = getProducts()
  return <ProductList productsPromise={productsPromise} />  // No Suspense!
}
```

```tsx
// CORRECT — Suspense catches the suspension from use()
export default function Page() {
  const productsPromise = getProducts()
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductList productsPromise={productsPromise} />
    </Suspense>
  )
}
```

### Anti-Pattern 3: Using useEffect to handle the promise

```tsx
// WRONG — do not manually resolve promises with useEffect
'use client'

import { useState, useEffect } from 'react'

export default function ProductList({
  productsPromise,
}: {
  productsPromise: Promise<Product[]>
}) {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    productsPromise.then(setProducts)
  }, [productsPromise])

  return <ul>{products.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

```tsx
// CORRECT — use() handles the promise natively
'use client'

import { use } from 'react'

export default function ProductList({
  productsPromise,
}: {
  productsPromise: Promise<Product[]>
}) {
  const products = use(productsPromise)

  return <ul>{products.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

### Anti-Pattern 4: Creating promises inside Client Components

```tsx
// WRONG — creates a new promise on every render
'use client'

import { use } from 'react'

export default function ProductList() {
  // This creates a new promise every render — infinite loop!
  const products = use(fetch('/api/products').then((r) => r.json()))

  return <ul>{products.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

**The promise must be created in the Server Component and passed as a prop.** Never create promises inside the Client Component that `use()` consumes.

## Summary

- Server Components create Promises (no await)
- Pass Promises as props to Client Components
- Client Components call `use()` to unwrap
- Wrap with `<Suspense>` for loading states
- Choose between per-section or page-level Suspense based on UX needs
- Use `useOptimistic` for instant mutation feedback
- Never use `useEffect` to handle these promises
