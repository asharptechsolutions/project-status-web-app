"use client";
import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from "react";
import { createClient } from "./supabase";
import type { UserRole } from "./types";
import type { User, Session } from "@supabase/supabase-js";

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  name: string;
  email: string;
  invited_at: string;
  joined_at: string | null;
  teams?: { id: string; name: string };
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  userId: string | null;
  orgId: string | null;
  orgName: string | null;
  role: UserRole | null;
  member: TeamMember | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isWorker: boolean;
  isClient: boolean;
  refreshMember: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  userId: null,
  orgId: null,
  orgName: null,
  role: null,
  member: null,
  loading: true,
  isPlatformAdmin: false,
  isAdmin: false,
  isOwner: false,
  isWorker: false,
  isClient: false,
  refreshMember: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<TeamMember | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Tracks the last user id we reacted to, so auth events that don't change the
  // identity (e.g. periodic token refreshes) don't retrigger the member fetch.
  const lastUserIdRef = useRef<string | null>(null);

  const supabase = createClient();

  const refreshMember = useCallback(async () => {
    if (!user) {
      setMember(null);
      setOrgId(null);
      setOrgName(null);
      setIsPlatformAdmin(false);
      setLoading(false);
      return;
    }

    // We have a user but haven't resolved their org/role yet. Keep loading=true
    // for the duration of the fetch so AuthGate shows the spinner instead of
    // briefly flashing OrgSetup (orgId is still null until the fetch lands).
    setLoading(true);

    try {
      // Get profile (includes platform admin flag)
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email, is_platform_admin")
        .eq("id", user.id)
        .single();

      setIsPlatformAdmin(profile?.is_platform_admin === true);

      // Get the user's first team membership
      const { data: memberData } = await supabase
        .from("team_members")
        .select("*, teams(id, name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (memberData) {
        // Mark as joined if not already. Goes through a server route with the
        // admin client — RLS won't let a member update their own team_members
        // row, so a client-side update silently no-ops and they stay "pending".
        if (!memberData.joined_at) {
          fetch("/api/member/mark-joined", { method: "POST" }).catch(() => {});
          memberData.joined_at = new Date().toISOString();
        }

        setMember({
          ...memberData,
          id: memberData.user_id,
          name: profile?.display_name || user.email?.split("@")[0] || "",
          email: profile?.email || user.email || "",
        } as TeamMember);
        const team = (memberData as any).teams;
        if (team) {
          setOrgId(team.id);
          setOrgName(team.name);
        }
      } else {
        setMember(null);
        setOrgId(null);
        setOrgName(null);
      }
    } catch (err) {
      console.error("Failed to load member data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const supabase = createClient();
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      lastUserIdRef.current = s?.user?.id ?? null;
      setUser(s?.user ?? null);
      // Only stop loading here if there's no user — if there IS a user,
      // refreshMember will set loading=false after fetching member data.
      if (!s?.user) {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      const nextId = s?.user?.id ?? null;
      // Ignore events that don't change the user identity (token refreshes fire
      // periodically with the same user) — avoids a needless member refetch.
      if (nextId === lastUserIdRef.current) return;
      lastUserIdRef.current = nextId;
      // On sign-in we have a user but not their org/role yet. Flip loading on in
      // the SAME render as setUser so AuthGate shows the spinner instead of
      // briefly flashing OrgSetup before refreshMember resolves orgId.
      if (nextId) setLoading(true);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      refreshMember();
    } else {
      setMember(null);
      setOrgId(null);
      setOrgName(null);
      // Don't set loading=false here — on mount, user is null before getSession
      // resolves, and setting loading=false would flash the landing page.
      // loading=false is handled by: getSession (no user) or refreshMember (has user).
    }
  }, [user, refreshMember]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setMember(null);
    setOrgId(null);
    setOrgName(null);
  }, []);

  const role: UserRole | null = member?.role as UserRole || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userId: user?.id || null,
        orgId,
        orgName,
        role,
        member,
        loading,
        isPlatformAdmin,
        isAdmin: role === "owner" || role === "admin",
        isOwner: role === "owner",
        isWorker: role === "worker",
        isClient: role === "client",
        refreshMember,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
