"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useUser, useOrganization } from "@clerk/clerk-react";
import { supabaseAdmin } from "./supabase";
import type { Member, UserRole } from "./types";

interface AuthCtx {
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
}

const AuthContext = createContext<AuthCtx>({
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
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const [member, setMember] = useState<Member | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshMember = useCallback(async () => {
    if (!user) {
      setMember(null);
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

      // Sync org to Supabase if we have one
      if (organization) {
        await supabaseAdmin
          .from("organizations")
          .upsert({
            id: organization.id,
            name: organization.name,
          }, { onConflict: "id" });

        // Get or create member record
        const { data: memberData } = await supabaseAdmin
          .from("members")
          .select("*")
          .eq("clerk_user_id", user.id)
          .eq("org_id", organization.id)
          .single();

        if (memberData) {
          setMember(memberData as Member);
        } else {
          // Auto-create member as admin if they created the org
          const { data: newMember } = await supabaseAdmin
            .from("members")
            .insert({
              clerk_user_id: user.id,
              org_id: organization.id,
              role: "admin",
              email: user.primaryEmailAddress?.emailAddress || "",
              name: user.fullName || user.firstName || "User",
            })
            .select()
            .single();
          setMember(newMember as Member);
        }
      } else {
        setMember(null);
      }
    } catch (err) {
      console.error("Failed to load member data:", err);
    } finally {
      setLoading(false);
    }
  }, [user, organization]);

  useEffect(() => {
    if (userLoaded && orgLoaded) {
      refreshMember();
    }
  }, [userLoaded, orgLoaded, refreshMember]);

  const role: UserRole | null = isPlatformAdmin
    ? "platform_admin"
    : member?.role || null;

  return (
    <AuthContext.Provider
      value={{
        userId: user?.id || null,
        orgId: organization?.id || null,
        orgName: organization?.name || null,
        role,
        member,
        loading: !userLoaded || !orgLoaded || loading,
        isPlatformAdmin,
        isAdmin: role === "admin" || role === "platform_admin",
        isWorker: role === "worker",
        isClient: role === "client",
        refreshMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
