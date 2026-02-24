# Next.js Architecture Skills for Claude Code

14 Claude Code skills that give Claude deep knowledge of Next.js App Router architecture, Server/Client Component patterns, data fetching, caching, routing, Suspense, and the Vercel AI SDK.

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
| `nextjs16-server-data-architecture` | Server-Authoritative Data Model — core philosophy for server-rendered applications |
| `nextjs16-cache-revalidation` | Tag-based cache revalidation with `revalidateTag()` — why it's preferred over `revalidatePath()` |
| `nextjs16-use-hook-data-flow` | React 19 `use()` hook data flow — passing Promises from Server to Client Components |
| `nextjs16-page-level-suspense` | Page-level holistic Suspense loading — unified skeletons for smooth page transitions |

## How It Works

Claude Code skills are markdown files in `.claude/skills/` that Claude automatically activates based on the context of your prompts. When you ask about Next.js routing, caching, or component architecture, the relevant skills are loaded to give Claude expert-level guidance.

No configuration is needed after installation. Just ask Claude about Next.js topics and the skills activate automatically.

## Acknowledgments

This project builds on the excellent work by **[@wsimmonds](https://github.com/wsimmonds)** and their [claude-nextjs-skills](https://github.com/wsimmonds/claude-nextjs-skills) repo, which provides the 10 foundational skills included here. That project was the inspiration for this package — we added 4 advanced `nextjs16-*` architecture skills and wrapped everything up for easy distribution. Go give the original repo a star!

## License

MIT
