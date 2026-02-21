# Workflowz

Team-based workflow and project tracking platform with two admin levels. **Team admins** (owners) create projects with workflow stages, manage a CRM of workers/clients/companies, and assign clients to projects. **Workers** progress stages through pending → in_progress → completed. **Clients** get a read-only tracking view. Projects have file uploads, real-time chat, internal notes, and visual workflow canvases. **Platform admins** manage all organizations from a separate `/admin` dashboard.

## Tech Stack

- **Framework**: Next.js 15.1 (App Router) + React 19 + TypeScript 5.9 (strict mode)
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage + RLS + Realtime)
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

`.env.local` requires:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (used by API routes for invites, admin operations)

## Project Structure

```
src/
├── app/
│   ├── layout.tsx               # Root layout: ThemeProvider, AuthProvider, Toaster
│   ├── page.tsx                 # Dashboard (project summary cards)
│   ├── projects/page.tsx        # Project CRUD, detail view, workflow canvas
│   ├── templates/page.tsx       # Reusable project templates (admin)
│   ├── workers/page.tsx         # Worker management (legacy, see CRM)
│   ├── track/page.tsx           # Client project tracking view (read-only)
│   ├── security/page.tsx        # Security settings
│   ├── crm/
│   │   ├── page.tsx             # CRM dashboard (Companies, Workers, Clients cards)
│   │   ├── companies/page.tsx   # Company CRUD with search/sort
│   │   ├── workers/page.tsx     # Worker management: invite, edit, resend, delete
│   │   └── clients/page.tsx     # Client management: invite, edit, company assign
│   ├── admin/
│   │   ├── layout.tsx           # Platform admin layout (AdminGate + AdminNavbar)
│   │   ├── page.tsx             # Platform overview (org/user/project stats)
│   │   └── organizations/page.tsx # Manage all organizations (CRUD)
│   ├── auth/
│   │   ├── callback/page.tsx    # OAuth/sign-in callback (PKCE + implicit)
│   │   └── set-password/page.tsx # Password set flow for invited users
│   └── api/
│       ├── invite/route.ts      # POST: invite users via supabase admin API
│       ├── members/
│       │   ├── update/route.ts  # PATCH: update member profile
│       │   └── delete/route.ts  # DELETE: remove member from team
│       └── admin/
│           ├── stats/route.ts   # GET: platform-wide statistics
│           └── organizations/
│               ├── route.ts     # GET: list all organizations
│               └── [id]/route.ts # PATCH/DELETE: manage single organization
├── components/
│   ├── ui/                      # Radix UI wrappers (button, dialog, select, card, calendar, popover, etc.)
│   ├── workflow-canvas.tsx      # React Flow canvas with Dagre auto-layout
│   ├── auth-gate.tsx            # Auth guard: loading → landing → org-setup → children
│   ├── admin-gate.tsx           # Auth guard for platform admin pages
│   ├── navbar.tsx               # Main navigation with role-based links
│   ├── admin-navbar.tsx         # Platform admin navigation
│   ├── auth-form.tsx            # Sign in/up form (Google OAuth + email/password)
│   ├── chat-bubble.tsx          # Floating chat panel: messages, files, realtime, read tracking
│   ├── project-notes.tsx        # Timestamped internal notes (admin add/delete, visible to workers)
│   ├── org-setup.tsx            # 3-step onboarding wizard (company → invite → project)
│   ├── landing-page.tsx         # Landing page for unauthenticated users
│   ├── app-providers.tsx        # Client-side provider wrapper
│   └── theme-provider.tsx       # Dark mode support
├── lib/
│   ├── data.ts                  # All Supabase CRUD operations (single data access layer)
│   ├── types.ts                 # TypeScript interfaces for all domain entities
│   ├── auth-context.tsx         # AuthProvider + useAuth() hook (user, org, role, isPlatformAdmin)
│   ├── supabase.ts              # Browser Supabase client
│   ├── supabase-server.ts       # Server-side Supabase client (for API routes)
│   ├── supabase-admin.ts        # Admin client with service role key (invites, admin ops)
│   ├── admin-auth.ts            # Server-side platform admin verification helper
│   ├── base-path.ts             # Base path config
│   └── utils.ts                 # cn() class merge utility
├── middleware.ts                # Supabase session refresh on all routes
supabase/
└── migrations/                  # SQL migrations (schema + RLS policies)
supabase-schema.sql              # Full base schema reference
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/data.ts` | All database operations — projects, stages, companies, members, messages, files, notes, templates, read status |
| `src/lib/types.ts` | Domain types: Project, ProjectStage, Company, Member, ProjectMessage, ProjectNote, ProjectFile, Template, AdminStats, etc. |
| `src/lib/auth-context.tsx` | Auth state — exposes `useAuth()` with user, orgId, orgName, role, member, isAdmin, isWorker, isClient, isPlatformAdmin, refreshMember, signOut |
| `src/middleware.ts` | Refreshes Supabase auth session on every route via cookies |
| `src/components/auth-gate.tsx` | Route guard: shows LandingPage → OrgSetup → page content based on auth state |
| `src/components/workflow-canvas.tsx` | React Flow visualization of project stages with drag, auto-align, status actions |
| `src/app/projects/page.tsx` | Largest page — project list, detail view, edit modal, stage management, multi-client assignment |
| `src/app/api/invite/route.ts` | Server-side invite flow using `supabase.auth.admin.inviteUserByEmail()` with service role key |

## Database

### Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Organization records |
| `teams` | Team records (UUID) |
| `team_members` | User membership — role (owner/admin/worker/client), invited_at, joined_at, company_id |
| `profiles` | User profiles — display_name, email, phone, `is_platform_admin` boolean |
| `projects` | Projects — name, status (active/completed/archived), company_id, workflow_locked/positions |
| `project_stages` | Workflow stages — name, status (pending/in_progress/completed), position, assigned_to |
| `project_clients` | Junction: multiple clients per project |
| `project_assignments` | Legacy client-project access |
| `companies` | Client companies (team-scoped) — name, email, phone, address |
| `messages` | Project chat messages — sender_id, content, file_id (FK to files) |
| `files` | File metadata — file_name, file_url, file_size, content_type |
| `message_read_status` | Per-user per-project last_read_at tracking |
| `project_notes` | Timestamped internal notes — author_id, author_name, content |
| `templates` | Reusable workflow templates — stages as JSONB array |
| `preset_stages` | Predefined stage names (team-scoped) |

### Conventions

- **Multi-tenancy**: All tables have `team_id`; queries always filter by orgId
- **Auth**: Supabase Auth with cookie-based sessions; roles in `team_members`
- **Roles**: `owner`/`admin` (full access), `worker` (progress stages), `client` (read-only tracking)
- **Platform admin**: `profiles.is_platform_admin = true` — separate from team roles, accesses `/admin` routes
- **Single member system**: All people (admins, workers, clients) exist in `team_members` + `profiles` only. No standalone workers/clients tables.
- **Invite flow**: `/api/invite/` creates auth.users entry + team_members row; `joined_at` null = pending, set on first login
- **RLS**: Row Level Security enabled on all tables
- **Realtime**: Messages table has REPLICA IDENTITY FULL for Supabase realtime subscriptions

## Routing

All pages are client-rendered (`"use client"`). API routes exist under `src/app/api/` for server-side operations requiring the service role key (invites, admin). The path alias `@/*` maps to `src/*` (`tsconfig.json`). Next.js config enables `trailingSlash` and `unoptimized` images (`next.config.ts`).

## Additional Documentation

When working on specific areas, check these files for detailed patterns:

| Topic | File |
|-------|------|
| Architectural patterns & conventions | `.claude/docs/architectural_patterns.md` |
