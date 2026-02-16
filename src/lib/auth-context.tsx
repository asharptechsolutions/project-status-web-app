"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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

    try {
      // Get the user's first team membership
      const { data: memberData } = await supabase
        .from("team_members")
        .select("*, teams(id, name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (memberData) {
        // Get profile for name/email
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, email")
          .eq("id", user.id)
          .single();
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
        // Owner role = admin equivalent
        setIsPlatformAdmin(memberData.role === "owner");
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
      setUser(s?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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
      setLoading(false);
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

  const role: UserRole | null = isPlatformAdmin
    ? "owner"
    : member?.role as UserRole || null;

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
        isAdmin: role === "owner",
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
