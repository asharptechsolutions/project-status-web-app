"use client";
import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { CommandPalette } from "@/components/command-palette";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <CommandPalette />
    </AuthProvider>
  );
}
