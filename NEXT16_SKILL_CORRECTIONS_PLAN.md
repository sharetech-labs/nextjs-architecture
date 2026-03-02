# Next.js 16 Skill Corrections Plan

Date: 2026-03-02  
Scope: Update the existing Next.js 16 architecture skills so they are accurate for current Next.js 16 cache APIs and cover the edge cases discussed (`updateTag` vs `revalidateTag`, `refresh()`, `force-dynamic`, 2MB cache limits, optimistic UI behavior).

## Source of truth (official docs)

- https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- https://nextjs.org/docs/app/api-reference/functions/updateTag
- https://nextjs.org/docs/app/getting-started/updating-data
- https://nextjs.org/docs/app/api-reference/functions/use-router
- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/docs/messages/revalidate-tag-single-arg
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
- https://vercel.com/docs/data-cache
- https://raw.githubusercontent.com/vercel/next.js/canary/packages/next/src/server/lib/incremental-cache/index.ts

## What needs to be corrected

Current skills still present an older rule of thumb: "always use `revalidateTag()` after mutation".  
For Next.js 16, that is incomplete and in some cases wrong.

### Required semantic updates

1. `revalidateTag(tag)` single-argument form is deprecated.
2. `updateTag(tag)` is the preferred Server Action API for read-your-own-writes.
3. `revalidateTag(tag, 'max')` is stale-while-revalidate (SWR), not immediate consistency.
4. `refresh()` refreshes the router payload but does not revalidate tags.
5. `force-dynamic` / `no-store` data cannot be tag-invalidated because it is not cached.
6. Tag-based invalidation depends on data actually being cached, and cache entries are size-limited (2MB item limit in Vercel Data Cache; Next.js fetch cache also has a 2MB guard).
7. `useOptimistic` is optimistic UI state, not cache invalidation. It needs explicit success/failure handling and a server-side freshness strategy.

## Global decision matrix to add to skills

Use this matrix verbatim across Next16 skill docs so the guidance is consistent:

| Scenario | API | Why |
|---|---|---|
| Server Action + user must immediately see their own write | `updateTag(tag)` | Immediate expiration/read-your-own-writes |
| Server Action/Route Handler + eventual consistency acceptable | `revalidateTag(tag, 'max')` | SWR semantics |
| Route Handler webhook invalidation requiring immediate expiration | `revalidateTag(tag, { expire: 0 })` | Immediate expiry outside Server Actions |
| `force-dynamic` / `cache: 'no-store'` data | `refresh()` or `redirect()` | No cache entry exists to invalidate by tag |
| Data payload exceeds cache entry size limits | Chunk data into cacheable units, or keep dynamic + `refresh()` | Oversized payloads are not cached |

## File-by-file update plan

## 1) `skills/nextjs16-cache-revalidation/SKILL.md`

### Frontmatter changes

- Update description so it does not claim "`revalidateTag()` is preferred" universally.
- Add trigger keywords: `updateTag`, `refresh`, `force-dynamic`, `no-store`.

Suggested description rewrite:

> Guide for Next.js 16 cache invalidation strategy using `updateTag`, `revalidateTag`, and `refresh` correctly by consistency requirements and cache mode. Covers read-your-own-writes, stale-while-revalidate, uncached dynamic routes, and tag design.

### Section changes

1. Replace "revalidateTag vs revalidatePath" as the top-level comparison with:
   - `updateTag vs revalidateTag vs refresh`
   - Then keep `revalidatePath` as a secondary comparison.
2. Add an explicit "Deprecated API usage" section:
   - `revalidateTag(tag)` single arg deprecated.
   - Prefer `revalidateTag(tag, 'max')` or `updateTag(tag)` in Server Actions.
3. Add "When tags do nothing" section:
   - `force-dynamic` and `no-store` are uncached, so tag invalidation has no effect.
4. Add "2MB cache entry constraints" section:
   - If response/value exceeds cache entry size, it may not be cached.
   - Provide chunking pattern (split collection/list/meta/detail tags).

### Example replacements

Replace primary mutation example:

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

Add SWR example:

```ts
import { revalidateTag } from 'next/cache'

export async function webhookRevalidateProduct(id: string) {
  revalidateTag('products', 'max')
  revalidateTag(`product-${id}`, 'max')
}
```

Add force-dynamic example:

```ts
'use server'

import { refresh } from 'next/cache'

export async function updateLiveDashboardSettings(input: SettingsInput) {
  await db.settings.update({ data: input })

  // Route uses force-dynamic/no-store; tags do not apply
  refresh()
}
```

## 2) `skills/nextjs16-server-data-architecture/SKILL.md`

### Core philosophy corrections

Current line of thinking:
- "Fresh data is triggered via `revalidateTag()`"

Replace with:
- Freshness strategy is chosen by cache mode and consistency needs:
  - cached + immediate consistency -> `updateTag`
  - cached + eventual consistency -> `revalidateTag(tag, 'max')`
  - uncached dynamic/no-store -> `refresh` or `redirect`

### Diagram update

Replace single-path data flow with a branching flow:

1. Mutation in Server Action
2. Branch A (cached data) -> `updateTag` or `revalidateTag(..., 'max')`
3. Branch B (no-store/force-dynamic) -> `refresh()`/`redirect()`
4. Server re-render sends updated RSC payload to client

### Anti-patterns to add

- Calling `revalidateTag` for data fetched with `cache: 'no-store'`.
- Relying on single-arg `revalidateTag(tag)` in new code.
- Claiming optimistic UI alone guarantees data correctness without server invalidation/refresh.

## 3) `skills/nextjs16-use-hook-data-flow/SKILL.md`

### Optimistic section upgrades

Keep `useOptimistic`, but make behavior complete:

1. Add `pending` and duplicate-submit guard (`useActionState`, `useTransition`, or `useFormStatus`).
2. Add explicit error rollback strategy:
   - revert optimistic change on failure, or call `router.refresh()` to reconcile.
3. Pair optimistic UI with server-side freshness API:
   - cached read-your-own-writes: `updateTag`
   - uncached dynamic: `refresh`

### Example replacement

```tsx
'use client'

import { use, useOptimistic, useState, useTransition } from 'react'
import { removeItem } from '@/actions/remove-item'

export default function ItemList({ itemsPromise }: { itemsPromise: Promise<Item[]> }) {
  const items = use(itemsPromise)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [optimisticItems, removeOptimistic] = useOptimistic(
    items,
    (state, removedId: string) => state.filter((item) => item.id !== removedId)
  )

  const handleRemove = (itemId: string) => {
    setError(null)
    removeOptimistic(itemId)

    startTransition(async () => {
      try {
        await removeItem(itemId) // Server Action does updateTag() or refresh()
      } catch {
        setError('Could not remove item. Retrying with server state.')
        // fallback: reconcile from server on next navigation/refresh
      }
    })
  }

  return (
    <div>
      {error ? <p>{error}</p> : null}
      <ul>
        {optimisticItems.map((item) => (
          <li key={item.id}>
            {item.name}
            <button disabled={isPending} onClick={() => handleRemove(item.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Terminology fix

Change wording from "optimistic cache updates" to:
- "optimistic UI updates (`useOptimistic`) + server cache invalidation/refresh"

## 4) `skills/nextjs-advanced-routing/SKILL.md` (cross-skill consistency pass)

This file is broader than Next16 but currently has examples that can reinforce old habits.

Update revalidation guidance block to:

- Server Action immediate consistency: `updateTag`
- Server Action/Route Handler eventual consistency: `revalidateTag(tag, 'max')`
- Route-specific broad invalidation: `revalidatePath`
- Uncached dynamic data refresh: `refresh`

Add one short note linking to `nextjs16-cache-revalidation` for full matrix.

## New section to add in one skill (recommended: `nextjs16-cache-revalidation`)

## Force-dynamic + large payload strategy

Add a practical section exactly for the case discussed:

- If route is `force-dynamic` and payload is large (>2MB), skip tag invalidation.
- Use Server Action mutation + `refresh()`/`redirect()` to fetch fresh server data.
- If tag invalidation is desired, restructure into smaller cacheable units and tag each unit.

Example checklist:

1. Split single huge payload into summary + paginated/detail endpoints
2. Tag summary/list/detail independently
3. Use `updateTag` for post-mutation read-your-own-writes
4. Keep truly live data uncached and refresh route after mutation

## Suggested wording updates (copy-ready)

Use these snippets in multiple skills:

- "`refresh()` refreshes the current route payload but does not invalidate tagged caches."
- "`updateTag()` is Server Actions-only and is preferred for immediate read-your-own-writes."
- "`revalidateTag(tag, 'max')` marks data stale for stale-while-revalidate behavior."
- "`revalidateTag(tag)` without a second argument is deprecated."
- "Tag invalidation only affects cached entries. Data fetched with `no-store` cannot be tag-revalidated."

## Validation checklist after edits

- No single-argument `revalidateTag(` usage remains in Next16 skills.
- Every mutation example chooses one of `updateTag`, `revalidateTag(..., 'max')`, `refresh`, or `revalidatePath` with a stated reason.
- At least one example shows `force-dynamic` + `refresh` pattern.
- At least one example explains 2MB cache-size constraint and chunking strategy.
- Optimistic examples include pending + failure behavior (not only happy path).
- Cross-links between `nextjs16-server-data-architecture`, `nextjs16-cache-revalidation`, and `nextjs16-use-hook-data-flow` remain consistent.

## Optional implementation sequence

1. Update `nextjs16-cache-revalidation` first (canonical semantics).
2. Update `nextjs16-server-data-architecture` to reference the new decision matrix.
3. Update `nextjs16-use-hook-data-flow` optimistic section.
4. Run a consistency pass on `nextjs-advanced-routing` references.
5. Run grep checks for deprecated patterns:
   - `revalidateTag\\('.*'\\)` (single arg)
   - `revalidateTag\\(` without second argument in examples
   - phrases claiming `revalidateTag` is always preferred.
