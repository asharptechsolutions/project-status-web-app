# Architectural Patterns

Patterns observed across multiple files in the Workflowz codebase. Follow these when making changes.

## 1. Page Structure

Every page uses a two-component pattern: an outer component wrapping with `AuthGate`, and an inner component containing the actual logic.

```
function PageInner() {           // Has useAuth(), useState, data fetching
  const { orgId, isAdmin } = useAuth();
  ...
}
export default function Page() { // Just wraps with auth guard
  return <AuthGate><PageInner /></AuthGate>;
}
```

**Seen in**: All 7 page files under `src/app/`. Reference: `src/app/page.tsx:15-49` (Dashboard pattern).

The inner component always:
- Calls `useAuth()` for orgId, userId, and role flags
- Guards data loading with `if (!orgId) return`
- Uses `<Navbar />` as the first child of the layout
- Wraps content in `<div className="min-h-[100dvh] flex flex-col">`

## 2. Data Access Layer

All database operations live in `src/lib/data.ts` as plain async functions. No ORM, no API routes — direct Supabase client queries.

Pattern: query Supabase → check error → throw or return data.

**Conventions**:
- Functions are grouped by domain with comment headers (e.g., `// ============ CLIENTS ============`)
- Errors are thrown immediately (`throw new Error(error.message)`), never returned
- Team isolation: most queries include `.eq("team_id", teamId)`
- Create functions accept `Omit<Entity, "id" | "created_at">` types
- Update functions accept `Partial<Entity>`

**Reference**: `src/lib/data.ts:1-3` (client setup), entire file for CRUD patterns.

## 3. Error Handling

The data layer throws; UI components catch and show toast notifications. This pattern is universal.

```
try {
  await dataLayerFunction(args);
  toast.success("Done");
} catch (err: any) {
  toast.error(err.message || "Fallback message");
}
```

**Seen in**: Every handler in `src/app/projects/page.tsx`, `src/app/members/page.tsx`, `src/app/templates/page.tsx`, `src/components/file-upload.tsx`, `src/components/project-chat.tsx`.

## 4. Form/CRUD Pattern

All create and edit flows follow the same structure:

1. `useState` for each form field + a `showNew`/`showEdit` boolean for the dialog
2. A `handleCreate`/`handleEdit` async handler that calls data.ts, shows toast, clears form, and calls `load()` to refresh
3. Loading state to prevent double-submit
4. Dialog component (from `src/components/ui/dialog.tsx`) for the form modal

**Reference**: `src/app/projects/page.tsx:176-240` (project creation), `src/app/templates/page.tsx` (template CRUD), `src/app/members/page.tsx` (member invite).

## 5. Role-Based Rendering

UI elements are conditionally rendered based on role flags from `useAuth()`:

```
{isAdmin && <Button>Admin Action</Button>}
{(isAdmin || isWorker) && <Button>Start Stage</Button>}
{isClient && <ReadOnlyView />}
```

Role flags: `isAdmin` (admin or owner), `isWorker`, `isClient`, `isPlatformAdmin`.

**Reference**: `src/lib/auth-context.tsx:19-33` (AuthCtx interface), `src/components/workflow-canvas.tsx:83-106` (stage action buttons).

## 6. UI Component Library

All `src/components/ui/*.tsx` files follow the same pattern:
- Thin wrapper around a Radix UI primitive
- `class-variance-authority` (CVA) for variant definitions
- `React.forwardRef` for DOM ref forwarding
- `cn()` utility (`src/lib/utils.ts`) to merge Tailwind classes safely

**Reference**: `src/components/ui/button.tsx` (canonical CVA + forwardRef example).

Do NOT create new UI primitives from scratch. Wrap Radix components and follow the existing pattern.

## 7. Auth Context

`useAuth()` hook from `src/lib/auth-context.tsx` provides all auth state. Every page and most components consume it.

Key values: `user`, `userId`, `orgId`, `orgName`, `role`, `member`, `isAdmin`, `isWorker`, `isClient`, `loading`, `signOut`, `refreshMember`.

**Convention**: Always check `orgId` before making data calls. The `AuthGate` component (`src/components/auth-gate.tsx:7-24`) handles the loading → unauthenticated → no-org → ready flow.

## 8. Dynamic Import for Heavy Components

Components that depend on browser-only libraries (e.g., React Flow) use Next.js `dynamic()` with `ssr: false`:

```
const WorkflowCanvas = dynamic(
  () => import("@/components/workflow-canvas").then((m) => m.WorkflowCanvas),
  { ssr: false, loading: () => <Spinner /> }
);
```

**Reference**: `src/app/projects/page.tsx:34-37`.

## 9. Team-Based Multi-Tenancy

All data is scoped by `team_id` (organization). This is enforced at two levels:

1. **Application level**: Every query in `data.ts` filters by `team_id` / `orgId`
2. **Database level**: RLS policies on every table check `team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())`

When adding new tables or queries, always include team_id filtering.

**Reference**: `supabase/migrations/20260216_fix_everything.sql` (RLS policy patterns), `src/lib/data.ts` (query patterns).

## 10. Database Conventions

- **Primary keys**: UUID via `gen_random_uuid()`
- **Foreign keys**: Use `ON DELETE CASCADE` for cleanup
- **Many-to-many**: Junction tables (e.g., `project_clients`, `project_assignments`) with unique constraints
- **Ordering**: Use numeric `position` column, not timestamps
- **Timestamps**: `created_at` (default `now()`), `updated_at`, `started_at`, `completed_at` as needed
- **RLS**: Enabled on all tables; one policy per operation (SELECT, INSERT, UPDATE, DELETE)

**Reference**: `supabase-schema.sql` (full schema), `src/lib/types.ts` (TypeScript mirrors of all tables).

## 11. State Management

No global state library (no Redux/Zustand). State flows through:

1. **AuthContext** — global auth/org/role state via React Context
2. **Component-local useState** — form fields, loading flags, selected items, dialog visibility
3. **Props callbacks** — parent passes `onFilesChange`, `onUpdateStatus`, etc. to children

Data is fetched in a `load()` callback (wrapped in `useCallback`) called from `useEffect` on mount and after mutations.

**Reference**: `src/app/projects/page.tsx:79-99` (load + useEffect pattern).
