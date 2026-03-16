"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProjects, getMembers, getCompanies } from "@/lib/data";
import type { Project, Member, Company } from "@/lib/types";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FolderOpen,
  CalendarDays,
  LayoutTemplate,
  Users,
  Settings,
  Plus,
  UserPlus,
  Building2,
  Wrench,
  Eye,
  Loader2,
} from "lucide-react";

// Module-level ref for external trigger
let externalSetOpen: ((open: boolean) => void) | null = null;
export function openCommandPalette() {
  externalSetOpen?.(true);
}

export function CommandPalette() {
  const { user, orgId, isAdmin, isClient } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Expose setOpen for external trigger
  useEffect(() => {
    externalSetOpen = setOpen;
    return () => {
      externalSetOpen = null;
    };
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    if (!user || !orgId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [user, orgId]);

  // Fetch data when opened
  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const fetches: Promise<unknown>[] = [getProjects(orgId)];
      if (isAdmin) {
        fetches.push(getMembers(orgId), getCompanies(orgId));
      }
      const results = await Promise.all(fetches);
      setProjects(results[0] as Project[]);
      if (isAdmin) {
        setMembers(results[1] as Member[]);
        setCompanies(results[2] as Company[]);
      }
    } catch {
      // Silently fail — palette still works for navigation
    } finally {
      setLoading(false);
    }
  }, [orgId, isAdmin]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  if (!user || !orgId) return null;

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  const workers = members.filter((m) => m.role === "owner" || m.role === "worker");
  const clients = members.filter((m) => m.role === "client");

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search projects, people, or type a command..." />
      <CommandList>
        <CommandEmpty>
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            "No results found."
          )}
        </CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect(() => router.push("/"))}>
            <LayoutDashboard className="text-muted-foreground" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => router.push("/projects/"))}>
            <FolderOpen className="text-muted-foreground" />
            <span>Projects</span>
          </CommandItem>
          {!isClient && (
            <>
              <CommandItem onSelect={() => handleSelect(() => router.push("/calendar/"))}>
                <CalendarDays className="text-muted-foreground" />
                <span>Calendar</span>
              </CommandItem>
              {isAdmin && (
                <>
                  <CommandItem onSelect={() => handleSelect(() => router.push("/templates/"))}>
                    <LayoutTemplate className="text-muted-foreground" />
                    <span>Templates</span>
                  </CommandItem>
                  <CommandItem onSelect={() => handleSelect(() => router.push("/crm/"))}>
                    <Users className="text-muted-foreground" />
                    <span>CRM</span>
                  </CommandItem>
                  <CommandItem onSelect={() => handleSelect(() => router.push("/settings/"))}>
                    <Settings className="text-muted-foreground" />
                    <span>Settings</span>
                  </CommandItem>
                </>
              )}
            </>
          )}
        </CommandGroup>

        {/* Quick Actions */}
        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => handleSelect(() => router.push("/projects/?new=1"))}>
                <Plus className="text-muted-foreground" />
                <span>New Project</span>
              </CommandItem>
              <CommandItem onSelect={() => handleSelect(() => router.push("/crm/?tab=workers&invite=1"))}>
                <UserPlus className="text-muted-foreground" />
                <span>Invite Worker</span>
              </CommandItem>
              <CommandItem onSelect={() => handleSelect(() => router.push("/crm/?tab=clients&invite=1"))}>
                <UserPlus className="text-muted-foreground" />
                <span>Invite Client</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.slice(0, 10).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project-${p.name}`}
                  onSelect={() => handleSelect(() => router.push(`/projects/?id=${p.id}`))}
                >
                  <FolderOpen className="text-muted-foreground" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <CommandShortcut>
                    {p.status === "completed" ? "completed" : p.status === "archived" ? "archived" : "active"}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* People — Workers */}
        {isAdmin && workers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workers">
              {workers.slice(0, 8).map((m) => (
                <CommandItem
                  key={m.id}
                  value={`worker-${m.name || ""} ${m.email || ""}`}
                  onSelect={() => handleSelect(() => router.push("/crm/?tab=workers"))}
                >
                  <Wrench className="text-muted-foreground" />
                  <span className="flex-1 truncate">{m.name || m.email}</span>
                  <CommandShortcut>{m.role}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* People — Clients */}
        {isAdmin && clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clients">
              {clients.slice(0, 8).map((m) => (
                <CommandItem
                  key={m.id}
                  value={`client-${m.name || ""} ${m.email || ""}`}
                  onSelect={() => handleSelect(() => router.push("/crm/?tab=clients"))}
                >
                  <Eye className="text-muted-foreground" />
                  <span className="flex-1 truncate">{m.name || m.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Companies */}
        {isAdmin && companies.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Companies">
              {companies.slice(0, 8).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`company-${c.name}`}
                  onSelect={() => handleSelect(() => router.push("/crm/?tab=companies"))}
                >
                  <Building2 className="text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
