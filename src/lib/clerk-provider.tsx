"use client";
import { ClerkProvider as BaseClerkProvider } from "@clerk/clerk-react";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_cHJlbWl1bS1zaGVlcGRvZy00Ni5jbGVyay5hY2NvdW50cy5kZXYk";

export function ClerkProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <BaseClerkProvider
      publishableKey={publishableKey}
      routerPush={(to) => router.push(to)}
      routerReplace={(to) => router.replace(to)}
    >
      {children}
    </BaseClerkProvider>
  );
}
