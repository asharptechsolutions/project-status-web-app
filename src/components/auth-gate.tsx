"use client";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LandingPage } from "@/components/landing-page";
import { OrgSetup } from "@/components/org-setup";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, orgId, isPlatformAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && isPlatformAdmin && !orgId) {
      router.replace("/admin/");
    }
  }, [loading, user, isPlatformAdmin, orgId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <LandingPage />;

  // Platform admin without org — redirect is happening via useEffect
  if (isPlatformAdmin && !orgId) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!orgId) return <OrgSetup />;

  return <>{children}</>;
}
