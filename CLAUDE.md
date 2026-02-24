# Workflowz

Team-based workflow and project tracking platform. **Team admins** (owners) create projects with workflow stages, manage a CRM of workers/clients/companies, and assign clients to projects. **Workers** progress stages through pending → in_progress → completed. **Clients** get a read-only tracking view. **Platform admins** manage all organizations from `/admin`.

## Tech Stack

Next.js 15.1 (App Router) + React 19 + TypeScript 5.9 (strict) + Supabase (PostgreSQL, Auth, Storage, RLS, Realtime) + Tailwind CSS 3.4 + Radix UI + lucide-react + sonner toasts + @xyflow/react + next-themes (dark mode)

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint via next lint
npx tsc --noEmit     # Type-check (works offline)
```

## Rules

### Data Access

- **ALL database operations go in `src/lib/data.ts`**. Never query Supabase directly from components or create new data files.
- **Always filter by `team_id`**. Every query must include `.eq("team_id", orgId)` for multi-tenancy. Missing this leaks data across organizations.
- **Throw errors, never swallow them**. Pattern: `if (error) throw new Error(error.message);` — let components handle with try/catch + toast.
- **Return typed data**: `return (data || []) as Project[];` — always cast and default to empty array.
- Create functions use `Omit<Entity, "id" | "created_at">`. Update functions use `Partial<Entity>`.

### Supabase Clients — Use the Right One

| Client | File | Where to use | When |
|--------|------|-------------|------|
| Browser | `lib/supabase.ts` | `data.ts`, components | All client-side DB ops, realtime subscriptions |
| Server | `lib/supabase-server.ts` | API routes only | Verify auth, read session cookies |
| Admin | `lib/supabase-admin.ts` | API routes only | Invites, user creation, bypassing RLS |

Never import the admin client in client-side code. Never use the browser client in API routes.

### Component Patterns

- **Every page uses `"use client"` + AuthGate wrapper**:
  ```
  export default function Page() { return <AuthGate><PageInner /></AuthGate>; }
  function PageInner() { const { orgId, isAdmin } = useAuth(); ... }
  ```
- **Guard data loading**: Always check `if (!orgId) return;` before fetching.
- **Loading states are mandatory**: `useState(true)` → show `<Loader2 className="animate-spin" />` → set false in `finally`.
- **Wrap load functions in `useCallback`** with `[orgId]` dependency, call from `useEffect`.
- **Use `dynamic()` with `ssr: false`** for heavy components (workflow-canvas, anything using browser APIs).
- **Reset form state when opening dialogs** — stale values from previous edits will confuse users.

### Error Handling

Components catch, data.ts throws. Always use this pattern:
```
try {
  await dataLayerFunction(args);
  toast.success("Done");
  load(); // refresh
} catch (err: any) {
  toast.error(err.message || "Fallback message");
}
```

### Auth & Roles

- `useAuth()` provides: `user`, `userId`, `orgId`, `role`, `isAdmin`, `isWorker`, `isClient`, `isPlatformAdmin`
- **`isAdmin` means `role === "owner"`** — this naming is confusing but intentional. Don't change it.
- Roles: `owner`/`admin` (full access), `worker` (progress stages), `client` (read-only)
- Platform admin is a separate flag on `profiles.is_platform_admin`, not a team role.
- All people live in `team_members` + `profiles`. There are no separate workers or clients tables.

### UI Conventions

- Use existing Radix UI wrappers in `components/ui/`. Never create UI primitives from scratch.
- Toasts: `toast.success()` / `toast.error()` from sonner. No alert() or console.log for user feedback.
- Icons: lucide-react only. Pattern: `<IconName className="h-4 w-4" />`.
- Use `cn()` from `lib/utils.ts` for conditional Tailwind classes.
- Imports use `@/` path alias (maps to `src/`).

### API Routes

Only create API routes when you need the service role key (invites, admin operations, anything that must bypass RLS). For normal CRUD, use `data.ts` which calls Supabase directly from the browser with RLS protection.

API routes must: validate input → verify auth via server client → check permissions → use admin client for privileged ops → return JSON with proper status codes.

### Database

- All tables have `team_id` for multi-tenancy + RLS policies
- Junction tables for many-to-many (e.g., `project_clients`)
- `joined_at = null` means invited but hasn't logged in yet
- Ordering uses numeric `position` column, not timestamps
- UUIDs via `gen_random_uuid()`, cascade deletes via FK

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/data.ts` | ALL database operations — the single data access layer |
| `src/lib/types.ts` | ALL TypeScript interfaces for domain entities |
| `src/lib/auth-context.tsx` | Auth state provider — `useAuth()` hook |
| `src/app/projects/page.tsx` | Largest page — reference for project CRUD patterns |
| `src/app/api/invite/route.ts` | Reference for API route patterns (auth + admin client) |

## Detailed Reference

For full patterns with code examples, see `.claude/docs/architectural_patterns.md`.
