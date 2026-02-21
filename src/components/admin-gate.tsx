"use client";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, isPlatformAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) {
      router.replace("/");
    }
  }, [loading, user, isPlatformAdmin, router]);

  if (loading || !user || !isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
