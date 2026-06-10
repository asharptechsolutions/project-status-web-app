"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSubscription } from "@/lib/data";
import type { Subscription } from "@/lib/types";
import { Loader2, CreditCard, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function BillingSettings({ orgId }: { orgId: string }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<"checkout" | "portal" | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      setSubscription(await getSubscription(orgId));
    } catch (err: any) {
      toast.error(err.message || "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const redirect = async (endpoint: "checkout" | "portal") => {
    setRedirecting(endpoint);
    try {
      const res = await fetch(`/api/billing/${endpoint}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Failed to open billing");
      setRedirecting(null);
    }
  };

  const isPro = subscription?.plan === "pro" && (subscription.status === "active" || subscription.status === "trialing");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> Billing
        </CardTitle>
        <CardDescription>Manage your organization&apos;s subscription. Only the account owner can see this.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  Current plan
                  <Badge variant={isPro ? "default" : "secondary"}>{isPro ? "Pro" : "Free"}</Badge>
                  {subscription?.status && subscription.status !== "active" && (
                    <Badge variant="outline" className="capitalize">{subscription.status.replace(/_/g, " ")}</Badge>
                  )}
                </p>
                {isPro && subscription?.current_period_end && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Renews {new Date(subscription.current_period_end).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={load} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {!isPro && (
                <Button onClick={() => redirect("checkout")} disabled={redirecting !== null}>
                  {redirecting === "checkout" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Upgrade to Pro
                </Button>
              )}
              {subscription?.stripe_customer_id && (
                <Button variant="outline" onClick={() => redirect("portal")} disabled={redirecting !== null}>
                  {redirecting === "portal" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  Manage billing
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Payments are processed by Stripe. Invoices, payment methods, and cancellation are handled in the billing portal.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
