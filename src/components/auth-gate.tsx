"use client";
import { ReactNode } from "react";
import { useUser, SignIn, useOrganization } from "@clerk/clerk-react";
import { useAuth } from "@/lib/auth-context";
import { LandingPage } from "@/components/landing-page";
import { OrgSetup } from "@/components/org-setup";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { loading } = useAuth();

  if (!userLoaded || !orgLoaded) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSignedIn) return <LandingPage />;

  // User is signed in but has no org - show org setup
  if (!organization) return <OrgSetup />;

  // Wait for member data to load
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
