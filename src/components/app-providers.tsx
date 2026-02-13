"use client";
import { ReactNode } from "react";
import { ClerkProvider } from "@/lib/clerk-provider";
import { AuthProvider } from "@/lib/auth-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <AuthProvider>{children}</AuthProvider>
    </ClerkProvider>
  );
}
