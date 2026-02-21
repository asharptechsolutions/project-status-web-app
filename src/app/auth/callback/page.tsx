"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Suspense } from "react";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  useEffect(() => {
    const supabase = createClient();

    async function handleCallback() {
      // 1. PKCE flow: code in query params
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        router.replace(error ? "/?error=auth_callback_failed" : next);
        return;
      }

      // 2. Implicit flow: tokens in hash fragment
      const hash = window.location.hash.substring(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          router.replace(error ? "/?error=auth_callback_failed" : next);
          return;
        }
      }

      // 3. No tokens found — redirect home
      router.replace(next);
    }

    handleCallback();
  }, [searchParams, router, next]);

  return (
    <div className="flex items-center justify-center min-h-[100dvh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[100dvh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <CallbackInner />
    </Suspense>
  );
}
