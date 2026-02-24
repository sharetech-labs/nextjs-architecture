---
name: nextjs16-page-level-suspense
description: Guide for the page-level holistic Suspense loading pattern in Next.js 16. CRITICAL for creating smooth page transitions where one unified skeleton represents the entire page while all data loads, instead of many individual spinners. Activates when prompt mentions loading.tsx, page skeleton, holistic loader, unified loading state, page-level Suspense, avoiding nested loaders, multiple use() calls in one component, or smooth page transitions. Essential for ensuring pages render all-at-once after all promises resolve rather than progressively popping in sections. Complements nextjs16-use-hook-data-flow which covers the use() hook mechanics — this skill covers the UX-level loading strategy. See also nextjs-advanced-routing for per-section Suspense as an alternative approach.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Page-Level Holistic Suspense Loading Pattern

## Overview

The **page-level Suspense** pattern uses a single loading boundary to cover an entire page. Multiple `use()` calls in one Client Component suspend together, and the user sees one cohesive skeleton until all data is ready. The page then renders all at once — no flickering, no sections popping in one by one.

This produces a smooth, app-like experience instead of a patchwork of individual spinners.

For the mechanics of `use()` and Suspense, see **`nextjs16-use-hook-data-flow`**.
For per-section Suspense as an alternative strategy, see the streaming section in **`nextjs-advanced-routing`**.

## When to Use This Skill

Use this skill when:
- Building a new page that fetches multiple data sources
- Deciding between one page-level skeleton vs. many per-section spinners
- Creating `loading.tsx` skeleton files
- Implementing a page where all sections should appear together
- Reviewing code that uses multiple Suspense boundaries when one would suffice

## The Core Pattern

### How it works

1. **Server Component** starts multiple fetches in parallel (no `await`)
2. **Single loading boundary** (either `loading.tsx` or explicit `<Suspense>`) shows a holistic skeleton
3. **Client Component** calls `use()` multiple times at the top — all suspend under the same boundary
4. **All data resolves** → the entire page renders at once

### Why multiple use() calls suspend together

When a Client Component calls `use()` on an unresolved Promise, React **suspends the entire component**. If the same component calls `use()` on two promises, it suspends on the first, and when that resolves it re-renders and suspends on the second if still pending. Because all promises were started in parallel on the server, they typically resolve close together. The single Suspense boundary above catches all suspensions, showing one skeleton throughout.

## Pattern A: Implicit Suspense via loading.tsx (Preferred for full pages)

Next.js automatically wraps the page in a Suspense boundary using the `loading.tsx` file as the fallback. This is the cleanest approach for data-heavy pages.

### Step 1: Server Component — start fetches, pass promises

```tsx
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth'
import { getProducts, getOrders, getFilterOptions } from '@/actions/data'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Page data — start in parallel, do NOT await
  const productsPromise = getProducts()
  const ordersPromise = getOrders()
  const filterOptionsPromise = getFilterOptions()

  return (
    <DashboardClient
      user={user}
      productsPromise={productsPromise}
      ordersPromise={ordersPromise}
      filterOptionsPromise={filterOptionsPromise}
    />
  )
}
```

**Key decisions:**
- `await` auth checks and redirects — these must complete before rendering
- Do NOT `await` page data — pass raw Promises so the page streams
- No explicit `<Suspense>` — `loading.tsx` handles it

### Step 2: loading.tsx — holistic skeleton matching the page layout

```tsx
// app/dashboard/loading.tsx
const SIDEBAR_WIDTH = 320

export default function DashboardLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main content skeleton */}
      <div className="flex-1 p-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Chart area */}
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse mb-6" />

        {/* Table rows */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Sidebar skeleton */}
      <div className="border-l p-4" style={{ width: SIDEBAR_WIDTH }}>
        <div className="h-8 w-32 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Key principles for the skeleton:**
- **Match the real page layout** — same grid structure, sidebar width, header height
- **Use the same layout wrapper** so the shell doesn't shift
- **Reuse skeleton components** for repeated elements (cards, rows)
- **One unified skeleton** — not individual loading states per section

### Step 3: Client Component — multiple use() calls at the top

```tsx
// app/dashboard/DashboardClient.tsx
'use client'

import { use, useState } from 'react'
import type { Product, Order, User, FilterOptions } from '@/types'

interface DashboardClientProps {
  user: User
  productsPromise: Promise<Product[]>
  ordersPromise: Promise<Order[]>
  filterOptionsPromise: Promise<FilterOptions>
}

export default function DashboardClient({
  user,
  productsPromise,
  ordersPromise,
  filterOptionsPromise,
}: DashboardClientProps) {
  // All use() calls suspend under the SAME boundary (loading.tsx)
  // The page skeleton shows until ALL promises resolve
  const products = use(productsPromise)
  const orders = use(ordersPromise)
  const filterOptions = use(filterOptionsPromise)

  // Now all data is available — render the full page
  const [filter, setFilter] = useState('')

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <main className="flex-1 p-6">
        <StatsRow products={products} orders={orders} />
        <OrdersChart orders={orders} />
        <ProductTable products={products} filter={filter} />
      </main>
      <aside className="border-l p-4 w-80">
        <FilterPanel options={filterOptions} onFilter={setFilter} />
      </aside>
    </div>
  )
}
```

**Critical detail:** The `use()` calls are at the **top of the component**, before any hooks or rendering logic. This ensures all data is available before any UI renders.

## Pattern B: Explicit Suspense with fallback={null}

For pages where you don't need a custom skeleton (e.g., the parent layout already provides structure), use an inline `<Suspense>` with `fallback={null}`:

```tsx
// app/settings/page.tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth'
import { getSettings } from '@/actions/data'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const settingsPromise = getSettings(user.id)

  return (
    <Suspense fallback={null}>
      <SettingsClient settingsPromise={settingsPromise} />
    </Suspense>
  )
}
```

**When to use this variation:**
- The parent layout already provides enough visual structure
- The page content area is small relative to the layout
- You want the layout chrome to render immediately with the content area empty until data arrives

## Choosing Between the Two Patterns

| Criteria | Pattern A: `loading.tsx` | Pattern B: `<Suspense fallback={null}>` |
|----------|--------------------------|------------------------------------------|
| **Full-page experience** | Yes — skeleton matches the entire page | No — blank content area |
| **Custom skeleton needed** | Yes | No |
| **Layout provides structure** | Not relied upon | Yes — layout chrome is enough |
| **File overhead** | Requires `loading.tsx` file | Inline, no extra file |
| **Use when** | Dashboards, detail pages, complex layouts | Simple pages within structured layouts |

## Building Effective Page Skeletons

### Rule 1: Mirror the real layout structure

```tsx
// GOOD — skeleton matches the actual page grid
export default function Loading() {
  return (
    <div className="grid grid-cols-[1fr_320px] h-screen">
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
      <div className="border-l p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}

// BAD — generic spinner that doesn't match the page
export default function Loading() {
  return <div className="flex justify-center p-8"><Spinner /></div>
}
```

### Rule 2: Share layout constants

Use the same dimension constants in both the skeleton and the real component:

```tsx
// shared constants (e.g., in a constants file or repeated in both)
const SIDEBAR_WIDTH = 320
const HEADER_HEIGHT = 64

// loading.tsx uses these exact values
// DashboardClient.tsx uses these exact values
// Result: zero layout shift when data arrives
```

### Rule 3: Create reusable skeleton components

Build skeleton components for repeated elements in your application:

```tsx
// components/skeletons/CardSkeleton.tsx
export default function CardSkeleton() {
  return (
    <div className="p-4 border rounded-lg">
      <div className="h-5 w-3/5 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-2/5 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse" />
    </div>
  )
}
```

Then use them in both `loading.tsx` and anywhere else a card placeholder is needed.

## Anti-Patterns

### Anti-Pattern 1: Per-section Suspense on a page that should load together

```tsx
// WRONG for pages where sections are visually connected
export default function Page() {
  const productsPromise = getProducts()
  const ordersPromise = getOrders()
  const statsPromise = getStats()

  return (
    <div>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsPanel statsPromise={statsPromise} />
      </Suspense>
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductList productsPromise={productsPromise} />
      </Suspense>
      <Suspense fallback={<OrdersSkeleton />}>
        <OrderGrid ordersPromise={ordersPromise} />
      </Suspense>
    </div>
  )
}
```

**Why it's wrong for this case:** Each section loads and appears independently. The user sees the page "build itself" piece by piece — stats appear, then products pop in, then orders. This creates visual instability and layout shift.

```tsx
// CORRECT — one Client Component, one boundary, all data together
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
// + loading.tsx shows the holistic skeleton
```

### Anti-Pattern 2: Awaiting all data in the Server Component

```tsx
// WRONG — blocks the entire page, no streaming, no skeleton shown
export default async function Page() {
  const products = await getProducts()
  const orders = await getOrders()
  const stats = await getStats()

  return (
    <DashboardClient
      products={products}
      orders={orders}
      stats={stats}
    />
  )
}
```

**Why it's wrong:** The page is blank until ALL data resolves. No skeleton is shown because the Server Component itself is blocked. The `loading.tsx` skeleton only appears during **Suspense suspension**, not during a synchronous `await` in the page function.

### Anti-Pattern 3: Skeleton that doesn't match the page layout

```tsx
// WRONG — generic loading indicator
export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner />
    </div>
  )
}
```

**Why it's wrong:** When data arrives, the page layout jumps from a centered spinner to a complex dashboard layout. This causes a jarring visual shift. The skeleton should preview the page structure so the transition feels like "filling in" rather than "replacing."

### Anti-Pattern 4: Splitting use() calls across child components

```tsx
// FRAGILE — children may suspend at different times
'use client'

function StatsSection({ statsPromise }: { statsPromise: Promise<Stats> }) {
  const stats = use(statsPromise)  // Suspends independently
  return <div>{stats.total}</div>
}

function ProductSection({ productsPromise }: { productsPromise: Promise<Product[]> }) {
  const products = use(productsPromise)  // Suspends independently
  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>
}

export default function DashboardClient({ statsPromise, productsPromise }) {
  return (
    <div>
      <StatsSection statsPromise={statsPromise} />
      <ProductSection productsPromise={productsPromise} />
    </div>
  )
}
```

**Why it's fragile:** Each child component suspends independently. If they're under the same Suspense boundary the page still works, but if someone later wraps them in separate boundaries, sections load independently. Keep `use()` calls **in the top-level Client Component** to make the all-at-once behavior explicit and resilient to refactoring.

```tsx
// CORRECT — all use() calls in one place
'use client'

export default function DashboardClient({ statsPromise, productsPromise }) {
  const stats = use(statsPromise)
  const products = use(productsPromise)

  return (
    <div>
      <StatsSection stats={stats} />
      <ProductSection products={products} />
    </div>
  )
}
```

## When Per-Section Suspense IS Appropriate

The holistic pattern is not always the right choice. Per-section Suspense (covered in **`nextjs-advanced-routing`** and **`nextjs16-use-hook-data-flow`**) is better when:

- **One section is dramatically slower** than others (e.g., 5s vs 200ms) — show fast data immediately
- **Sections are truly independent pages** (parallel routes like `@sidebar` and `@main`)
- **The user benefits from partial information** (e.g., showing a header with the user's name while the feed loads)

The decision is about **user experience**: does the user benefit more from seeing the complete page at once, or from seeing parts of it early?

For most data-heavy pages — dashboards, detail views, management pages — the holistic pattern produces the better experience.

## Summary

- One Suspense boundary per page (via `loading.tsx` or explicit `<Suspense>`)
- Multiple `use()` calls in a single Client Component suspend together
- The skeleton matches the real page layout — same grid, same dimensions
- All data appears at once — no flickering, no layout shift
- Reserve per-section Suspense for cases where partial data is genuinely useful
