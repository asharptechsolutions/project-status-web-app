# Workflowz

Team-based workflow and project tracking platform. Admins create projects with workflow stages, assign clients, and workers progress stages through pending → in_progress → completed. Clients get a read-only tracking view. Projects have file uploads, chat, and visual workflow canvases.

## Tech Stack

- **Framework**: Next.js 15.1 (App Router) + React 19 + TypeScript 5.9 (strict mode)
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **UI**: Tailwind CSS 3.4 + Radix UI primitives + lucide-react icons + sonner toasts
- **Workflow canvas**: @xyflow/react 12.4 + @dagrejs/dagre 2.0 for node layout
- **Theming**: next-themes (dark mode via `class` strategy)

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (requires network for Google Fonts)
npm run lint         # ESLint via next lint
npx tsc --noEmit     # Type-check without building (works offline)
```

## Environment

Copy `.env.example` → `.env.local` with:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key

## Project Structure

```
src/
├── app/                         # Next.js App Router pages
│   ├── layout.tsx               # Root layout: ThemeProvider, AuthProvider, Toaster
│   ├── page.tsx                 # Dashboard (project summary cards)
│   ├── projects/page.tsx        # Project CRUD, detail view, workflow canvas
│   ├── templates/page.tsx       # Reusable project templates (admin)
│   ├── members/page.tsx         # Team member management (admin)
│   ├── workers/page.tsx         # Worker management
│   ├── track/page.tsx           # Client project tracking view
│   └── security/page.tsx        # Security settings
├── components/
│   ├── ui/                      # Radix UI wrappers (button, dialog, select, etc.)
│   ├── workflow-canvas.tsx      # React Flow canvas with Dagre auto-layout
│   ├── auth-gate.tsx            # Auth guard: loading → landing → org-setup → children
│   ├── navbar.tsx               # Navigation bar with role-based links
│   ├── file-upload.tsx          # Project file upload/download
│   ├── project-chat.tsx         # In-project messaging
│   ├── app-providers.tsx        # Client-side provider wrapper
│   └── landing-page.tsx, org-setup.tsx, theme-provider.tsx
├── lib/
│   ├── data.ts                  # All Supabase CRUD operations (single data access layer)
│   ├── types.ts                 # TypeScript interfaces for all domain entities
│   ├── auth-context.tsx         # AuthProvider + useAuth() hook (user, org, role)
│   ├── supabase.ts              # Browser Supabase client
│   ├── supabase-server.ts       # Server-side Supabase client
│   └── utils.ts                 # cn() class merge utility
├── middleware.ts                # Supabase session refresh on all routes
supabase/
└── migrations/                  # SQL migrations (schema + RLS policies)
supabase-schema.sql              # Full base schema reference
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/data.ts` | All database operations — CRUD for projects, stages, clients, templates, members, files, messages |
| `src/lib/types.ts` | Domain type definitions: Project, ProjectStage, Client, Member, Template, etc. |
| `src/lib/auth-context.tsx` | Auth state provider — exposes `useAuth()` with user, orgId, role, isAdmin/isWorker/isClient |
| `src/middleware.ts` | Refreshes Supabase auth session on every route via cookies |
| `src/components/auth-gate.tsx` | Route guard: shows LandingPage → OrgSetup → page content based on auth state |
| `src/components/workflow-canvas.tsx` | React Flow visualization of project stages with drag, auto-align, status actions |
| `src/app/projects/page.tsx` | Largest page — project list, detail view, edit modal, stage management, client assignment |

## Database

- **Multi-tenancy**: All tables have `team_id` column; queries always filter by orgId
- **Auth**: Supabase Auth with cookie-based sessions; roles stored in `team_members` table
- **Roles**: `admin` (full access), `worker` (can progress stages), `client` (read-only tracking)
- **RLS**: Row Level Security enabled on all tables; policies check team membership
- **Key relationships**: Projects → Stages (1:many), Projects ↔ Clients (many:many via `project_clients`)
- **Schema reference**: `supabase-schema.sql` for full table definitions; `supabase/migrations/` for incremental changes

## Routing

All pages are client-rendered (`"use client"`). No API routes — components query Supabase directly via `src/lib/data.ts`. The path alias `@/*` maps to `src/*` (`tsconfig.json`). Next.js config enables `trailingSlash` and `unoptimized` images (`next.config.ts`).

## Additional Documentation

When working on specific areas, check these files for detailed patterns:

| Topic | File |
|-------|------|
| Architectural patterns & conventions | `.claude/docs/architectural_patterns.md` |
