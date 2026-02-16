"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { createClient } from "./supabase";
import { supabaseAdmin } from "./supabase";
import type { Member, UserRole } from "./types";
import type { User, Session } from "@supabase/supabase-js";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  userId: string | null;
  orgId: string | null;
  orgName: string | null;
  role: UserRole | null;
  member: Member | null;
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

const supabase = createClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

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
      // Check platform admin status
      const { data: adminData } = await supabaseAdmin
        .from("platform_admins")
        .select("clerk_user_id")
        .eq("clerk_user_id", user.id)
        .single();
      setIsPlatformAdmin(!!adminData);

      // Get the user's first organization membership
      const { data: memberData } = await supabaseAdmin
        .from("members")
        .select("*, organizations(id, name)")
        .eq("clerk_user_id", user.id)
        .limit(1)
        .single();

      if (memberData) {
        setMember(memberData as Member);
        const org = (memberData as any).organizations;
        if (org) {
          setOrgId(org.id);
          setOrgName(org.name);
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setMember(null);
    setOrgId(null);
    setOrgName(null);
  }, []);

  const role: UserRole | null = isPlatformAdmin
    ? "platform_admin"
    : member?.role || null;

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
        loading: loading,
        isPlatformAdmin,
        isAdmin: role === "admin" || role === "platform_admin",
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
