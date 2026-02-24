# Architectural Patterns

Detailed patterns and code examples for the Workflowz codebase. The CLAUDE.md file contains concise rules — this file has the full reference.

## 1. Page Structure

Every page uses a two-component pattern:

```tsx
"use client";
import { AuthGate } from "@/components/auth-gate";

function PageInner() {
  const { orgId, isAdmin } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const result = await getData(orgId);
      setData(result);
    } catch (err: any) {
      toast.error(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      {/* Page content */}
    </div>
  );
}

export default function Page() {
  return <AuthGate><PageInner /></AuthGate>;
}
```

**Seen in**: All page files under `src/app/`.

## 2. Data Access Layer (`data.ts`)

All database operations live in `src/lib/data.ts`. Functions are grouped by domain with comment headers.

### CRUD Pattern

```tsx
// READ (list)
export async function getProjects(orgId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("team_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Project[];
}

// CREATE
export async function createProject(
  project: Omit<Project, "id" | "created_at" | "updated_at">
): Promise<string> {
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

// UPDATE
export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// DELETE
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
```

### Join + Transform Pattern

```tsx
export async function getMembers(orgId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*, profiles(display_name, email, phone), companies(name)")
    .eq("team_id", orgId);
  if (error) throw new Error(error.message);
  return (data || []).map((d: any) => ({
    id: d.user_id,
    user_id: d.user_id,
    team_id: d.team_id,
    role: d.role,
    name: d.profiles?.display_name || d.profiles?.email || "",
    email: d.profiles?.email || "",
    // ... transform fields
  })) as Member[];
}
```

### Junction Table Pattern

```tsx
export async function setProjectClients(projectId: string, clientIds: string[]): Promise<void> {
  // Delete existing
  const { error: delError } = await supabase
    .from("project_clients").delete().eq("project_id", projectId);
  if (delError) throw new Error(delError.message);
  // Insert new
  if (clientIds.length > 0) {
    const rows = clientIds.map((cid) => ({ project_id: projectId, client_id: cid }));
    const { error: insError } = await supabase.from("project_clients").insert(rows);
    if (insError) throw new Error(insError.message);
  }
}
```

### Batch Query Pattern

```tsx
export async function getStagesForProjects(projectIds: string[]): Promise<ProjectStage[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("project_stages").select("*").in("project_id", projectIds);
  if (error) throw new Error(error.message);
  return (data || []) as ProjectStage[];
}
```

## 3. Dialog / CRUD Modal Pattern

```tsx
const [showDialog, setShowDialog] = useState(false);
const [loading, setLoading] = useState(false);
const [editingId, setEditingId] = useState<string | null>(null);
const [value, setValue] = useState("");

const handleSubmit = async () => {
  setLoading(true);
  try {
    if (editingId) {
      await updateItem(editingId, value);
    } else {
      await createItem({ team_id: orgId, name: value });
    }
    setShowDialog(false);
    setValue("");
    toast.success(editingId ? "Updated" : "Created");
    load();
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    setLoading(false);
  }
};

// Open for create — reset state
<Button onClick={() => { setEditingId(null); setValue(""); setShowDialog(true); }}>New</Button>

// Open for edit — populate state
<Button onClick={() => { setEditingId(item.id); setValue(item.name); setShowDialog(true); }}>Edit</Button>

<Dialog open={showDialog} onOpenChange={setShowDialog}>
  <DialogContent>
    <DialogHeader><DialogTitle>{editingId ? "Edit" : "New"} Item</DialogTitle></DialogHeader>
    <Input value={value} onChange={(e) => setValue(e.target.value)} />
    <Button onClick={handleSubmit} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : "Save"}
    </Button>
  </DialogContent>
</Dialog>
```

## 4. Role-Based Rendering

```tsx
const { isAdmin, isWorker, isClient } = useAuth();

// Guard entire page
if (!isAdmin) {
  return <Card><CardContent>Only admins can access this.</CardContent></Card>;
}

// Conditional elements
{isAdmin && <Button>Admin Action</Button>}
{(isAdmin || isWorker) && <Button>Progress Stage</Button>}
{isClient && <ReadOnlyView />}
```

## 5. Supabase Client Usage

### Browser Client (components + data.ts)
```tsx
import { createClient } from "@/lib/supabase";
const supabase = createClient();
```

### Server Client (API routes — auth verification)
```tsx
import { createServerSupabaseClient } from "@/lib/supabase-server";
const supabase = await createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();
```

### Admin Client (API routes — privileged operations)
```tsx
import { createAdminClient } from "@/lib/supabase-admin";
const adminClient = createAdminClient();
// Can bypass RLS, create users, send invites
```

### Realtime Subscription Pattern
```tsx
useEffect(() => {
  const channel = supabase
    .channel(`messages:${projectId}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
      () => { loadMessages(); }
    ).subscribe();

  const pollInterval = setInterval(() => loadMessages(), 5000); // safety net

  return () => {
    supabase.removeChannel(channel);
    clearInterval(pollInterval);
  };
}, [projectId]);
```

## 6. API Route Pattern

```tsx
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.email || !body.teamId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify caller
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check permissions
    const { data: member } = await supabase
      .from("team_members").select("role")
      .eq("user_id", user.id).eq("team_id", body.teamId).single();
    if (!member || member.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Privileged operation
    const adminClient = createAdminClient();
    // ... admin operations ...

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

## 7. UI Patterns

### Search + Filter
```tsx
<div className="flex flex-col sm:flex-row gap-3 mb-4">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
    <Input placeholder="Search..." value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
    {searchQuery && (
      <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2">
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
  <Select value={filter} onValueChange={setFilter}>
    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Empty State
```tsx
{items.length === 0 ? (
  <Card><CardContent className="text-center text-muted-foreground">No items yet</CardContent></Card>
) : (
  <div className="flex flex-col gap-3">
    {items.map((item) => (
      <Card key={item.id}>
        <CardContent className="pt-4 pb-4 flex items-center gap-4">
          {/* Item content */}
        </CardContent>
      </Card>
    ))}
  </div>
)}
```

### Button with Loading
```tsx
<Button onClick={handleSubmit} disabled={loading}>
  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : <><Plus className="h-4 w-4 mr-2" />Create</>}
</Button>
```

## 8. State Management

No global state library. State flows through:
1. **AuthContext** — global auth/org/role via React Context
2. **Component-local `useState`** — form fields, loading, selected items, dialog visibility
3. **Props callbacks** — parent passes `onFilesChange`, `onUpdateStatus` to children

Data fetched in `load()` callback (wrapped in `useCallback`) called from `useEffect` on mount and after mutations.

### Memoization
```tsx
const clientMembers = useMemo(() => members.filter((m) => m.role === "client"), [members]);
const workerNames = useMemo(() => {
  const map: Record<string, string> = {};
  workerMembers.forEach((w) => { map[w.user_id] = w.name || w.email; });
  return map;
}, [workerMembers]);
```

## 9. Project Structure

```
src/app/           Pages (all "use client" + AuthGate)
src/app/api/       API routes (server-side, service role key)
src/components/    Reusable components
src/components/ui/ Radix UI wrappers (never create from scratch)
src/lib/data.ts    ALL database operations
src/lib/types.ts   ALL TypeScript interfaces
src/lib/auth-context.tsx  Auth provider + useAuth() hook
src/lib/supabase*.ts      Supabase client variants
supabase/migrations/      SQL migrations + RLS policies
```

## 10. Database Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Organization records |
| `teams` | Team records (UUID) |
| `team_members` | User membership — role, invited_at, joined_at, company_id |
| `profiles` | User profiles — display_name, email, phone, is_platform_admin |
| `projects` | Projects — name, status, company_id, workflow_locked/positions |
| `project_stages` | Workflow stages — name, status, position, assigned_to |
| `project_clients` | Junction: multiple clients per project |
| `companies` | Client companies (team-scoped) |
| `messages` | Project chat messages |
| `files` | File metadata |
| `message_read_status` | Per-user per-project last_read_at |
| `project_notes` | Internal notes (admin add/delete, visible to workers) |
| `templates` | Reusable workflow templates (stages as JSONB) |
| `preset_stages` | Predefined stage names (team-scoped) |
