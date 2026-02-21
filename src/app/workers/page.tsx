"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkersRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/crm/workers/"); }, [router]);
  return <div className="flex items-center justify-center min-h-[100dvh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
}
