"use client";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { LandingPage } from "@/components/landing-page";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-[100dvh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!user) return <LandingPage />;
  return <>{children}</>;
}
