# Next.js Architecture Skills for Claude Code

14 Claude Code skills that give Claude deep knowledge of Next.js App Router architecture, Server/Client Component patterns, data fetching, caching, routing, Suspense, and the Vercel AI SDK.

What makes this enhanced skill repo unique is how it codifies a modern React methodology around less code and clearer boundaries: a server-authoritative data model, Server Actions instead of noisy `useEffect` orchestration, and React 19 `use()` flows that remove client-side fetch boilerplate. Combined with the ability to produce page-level or nested Suspense patterns, Claude is enabled to provide elegant and consolidated loader patterns, stronger security by keeping sensitive logic on the server, and a faster path to maintainable production architecture.

## Quick Install

### Option 1: npx (recommended)

```bash
# Install to current project
npx @sharetech-labs/nextjs-claude-skills

# Install globally
npx @sharetech-labs/nextjs-claude-skills --global
```

### Option 2: Claude Code Plugin Marketplace

```
/plugin marketplace add sharetech-labs/nextjs-architecture-skills
/plugin install nextjs-architecture-skills@sharetech-labs-nextjs-architecture-skills
```

### Option 3: curl

```bash
# Install to current project
curl -fsSL https://raw.githubusercontent.com/sharetech-labs/nextjs-architecture-skills/main/install.sh | bash

# Install globally
curl -fsSL https://raw.githubusercontent.com/sharetech-labs/nextjs-architecture-skills/main/install.sh | bash -s -- --global
```

### Manual

Clone this repo and copy the `skills/` directory into your project's `.claude/skills/` (or `~/.claude/skills/` for global access).

## Skill Inventory

### Foundational Skills

| Skill | Description |
|-------|-------------|
| `nextjs-app-router-fundamentals` | App Router basics — migration from Pages Router, layouts, routing, metadata, `generateStaticParams` |
| `nextjs-server-client-components` | Choosing between Server and Client Components — cookie/header access, searchParams, React `use()` API |
| `nextjs-server-navigation` | Navigation in Server Components — `Link` component and `redirect()` |
| `nextjs-advanced-routing` | Route Handlers, Parallel Routes, Intercepting Routes, Server Actions, error boundaries, streaming |
| `nextjs-dynamic-routes-params` | Dynamic routes and pathname parameters — avoiding over-nesting with simple route structures |
| `nextjs-pathname-id-fetch` | Fetching data using URL parameters — dynamic routes and route params to API calls |
| `nextjs-use-search-params-suspense` | `useSearchParams` with Suspense boundaries — `'use client'` directive and Suspense wrapper pattern |
| `nextjs-client-cookie-pattern` | Client components calling server actions to set cookies — the two-file pattern |
| `nextjs-anti-patterns` | Detect and fix common App Router anti-patterns — inappropriate `useEffect`/`useState`, performance issues |
| `vercel-ai-sdk` | Vercel AI SDK v5 — `generateText`, `streamText`, `useChat`, tool calling, embeddings, MCP integration |

### Advanced Architecture Skills (Next.js 16 + React 19)

| Skill | Description |
|-------|-------------|
| `nextjs16-server-data-architecture` | Server-Authoritative Data Model — core philosophy for server-rendered applications with branching freshness strategies |
| `nextjs16-cache-revalidation` | Cache invalidation strategy using `updateTag`, `revalidateTag`, and `refresh` — choosing the right API by consistency requirements and cache mode |
| `nextjs16-use-hook-data-flow` | React 19 `use()` hook data flow — passing Promises from Server to Client Components with complete optimistic UI patterns |
| `nextjs16-page-level-suspense` | Page-level holistic Suspense loading — unified skeletons for smooth page transitions |

### Next.js 16 Cache Strategy & Server-Side Data Freshness

The advanced skills encode a critical awareness of how Next.js 16 handles cache invalidation. Rather than a one-size-fits-all `revalidateTag()` call, the correct API depends on **cache mode** and **consistency requirements**:

| Scenario | API | Behavior |
|----------|-----|----------|
| Interactive mutation — user must see their own write | `updateTag(tag)` | Immediate expiration (Server Actions only) |
| Webhook or background job — eventual consistency is fine | `revalidateTag(tag, 'max')` | Stale-while-revalidate (SWR) |
| Uncached route (`force-dynamic` / `no-store`) | `refresh()` or `redirect()` | No cache entry exists to invalidate |

Key points Claude is now aware of:
- **`revalidateTag(tag)` single-arg form is deprecated** in Next.js 16 — a second argument is always required
- **Tag invalidation only works on cached data** — calling `updateTag` or `revalidateTag` on `force-dynamic`/`no-store` routes is a silent no-op
- **Cache entries are capped at 2MB** — oversized payloads are never cached, so tags have no effect; the skills teach a chunking strategy to break large data into independently tagged units
- **Optimistic UI is not cache invalidation** — `useOptimistic` must always be paired with server-side freshness (`updateTag` or `refresh`), plus pending-state guards and error rollback
- **`refresh()` refreshes the route payload but does not invalidate tagged caches** — it is the correct tool for uncached dynamic routes, not a substitute for tag-based invalidation

## How It Works

Claude Code skills are markdown files in `.claude/skills/` that Claude automatically activates based on the context of your prompts. When you ask about Next.js routing, caching, or component architecture, the relevant skills are loaded to give Claude expert-level guidance.

No configuration is needed after installation. Just ask Claude about Next.js topics and the skills activate automatically.

## Acknowledgments

This project builds on the excellent work by **[@wsimmonds](https://github.com/wsimmonds)** and their [claude-nextjs-skills](https://github.com/wsimmonds/claude-nextjs-skills) repo, which provides the 10 foundational skills included here. That project was the inspiration for this package — we added 4 advanced `nextjs16-*` architecture skills and wrapped everything up for easy distribution. Go give the original repo a star!

## License

MIT
