"use client";
import { useEffect, useState, useCallback } from "react";
import { getProjectInvoices } from "@/lib/data";
import type { Invoice } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, Loader2, CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

function money(n: number): string {
  return `$${(n || 0).toFixed(2)}`;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-600 text-white",
  accepted: "bg-emerald-600 text-white",
  paid: "bg-green-600 text-white",
  void: "bg-muted text-muted-foreground",
};

/** Client-facing list of quotes/invoices the shop has shared on this project. */
export function ClientInvoices({ projectId }: { projectId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Drafts are internal — clients only see sent/accepted/paid documents
      const all = await getProjectInvoices(projectId);
      setInvoices(all.filter((i) => i.status !== "draft" && i.status !== "void"));
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const acceptQuote = async (inv: Invoice) => {
    setAccepting(inv.id);
    try {
      const res = await fetch("/api/invoices/accept/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: inv.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept");
      toast.success("Quote accepted");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to accept quote");
    } finally {
      setAccepting(null);
    }
  };

  if (loading) return null;
  if (invoices.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardContent className="pt-4 pb-4 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> Quotes & Invoices</p>
        {invoices.map((inv) => (
          <div key={inv.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium capitalize">{inv.kind}</span>
                <Badge className={STATUS_STYLE[inv.status]}>{inv.status}</Badge>
              </div>
              <span className="font-semibold tabular-nums">{money(inv.total)}</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {inv.line_items.map((li, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="truncate">{li.description} {li.quantity > 1 ? `× ${li.quantity}` : ""}</span>
                  <span className="tabular-nums shrink-0">{money(li.quantity * li.unit_price)}</span>
                </div>
              ))}
            </div>
            {inv.notes && <p className="text-xs text-muted-foreground mt-2 italic">{inv.notes}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {inv.kind === "quote" && inv.status === "sent" && (
                <Button size="sm" onClick={() => acceptQuote(inv)} disabled={accepting === inv.id}>
                  {accepting === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                  Accept quote
                </Button>
              )}
              {inv.kind === "invoice" && inv.status !== "paid" && inv.payment_url && (
                <Button size="sm" asChild>
                  <a href={inv.payment_url} target="_blank" rel="noopener noreferrer">
                    Pay {money(inv.total)} <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </a>
                </Button>
              )}
              {inv.status === "paid" && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Paid — thank you!
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
