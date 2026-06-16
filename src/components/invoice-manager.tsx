"use client";
import { useEffect, useState, useCallback } from "react";
import {
  getProjectInvoices, createInvoice, updateInvoice, deleteInvoice, computeInvoiceTotals,
} from "@/lib/data";
import type { Invoice, InvoiceLineItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileText, Plus, Trash2, Loader2, Send, ArrowRightCircle, CheckCircle2,
  Receipt, DollarSign, Clock, Pencil,
} from "lucide-react";
import { toast } from "sonner";

function money(n: number): string {
  return `$${(n || 0).toFixed(2)}`;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-600 text-white",
  accepted: "bg-emerald-600 text-white",
  paid: "bg-green-600 text-white",
  void: "bg-muted text-muted-foreground line-through",
};

interface InvoiceManagerProps {
  projectId: string;
  teamId: string;
  userId: string;
  /** Billable minutes tracked on this project — powers the "labor from time" helper */
  billableMinutes: number;
}

export function InvoiceManager({ projectId, teamId, userId, billableMinutes }: InvoiceManagerProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [kind, setKind] = useState<"quote" | "invoice">("quote");
  const [items, setItems] = useState<InvoiceLineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [laborRate, setLaborRate] = useState(75);

  const load = useCallback(async () => {
    try {
      setInvoices(await getProjectInvoices(projectId));
    } catch (err: any) {
      toast.error(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openNew = (newKind: "quote" | "invoice") => {
    setEditing(null);
    setKind(newKind);
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    setTaxRate(0);
    setNotes("");
    setPaymentUrl("");
    setShowEditor(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setKind(inv.kind);
    setItems(inv.line_items.length ? inv.line_items : [{ description: "", quantity: 1, unit_price: 0 }]);
    setTaxRate(inv.tax_rate);
    setNotes(inv.notes || "");
    setPaymentUrl(inv.payment_url || "");
    setShowEditor(true);
  };

  const addLaborLine = () => {
    const hours = +(billableMinutes / 60).toFixed(2);
    if (hours <= 0) { toast.info("No billable time tracked on this project yet"); return; }
    setItems((prev) => [...prev.filter((i) => i.description), { description: `Labor (${hours} hrs)`, quantity: hours, unit_price: laborRate }]);
    toast.success(`Added ${hours} billable hours`);
  };

  const totals = computeInvoiceTotals(items, taxRate);

  const handleSave = async () => {
    const cleaned = items.filter((i) => i.description.trim());
    if (cleaned.length === 0) { toast.error("Add at least one line item"); return; }
    setSaving(true);
    try {
      const t = computeInvoiceTotals(cleaned, taxRate);
      if (editing) {
        await updateInvoice(editing.id, {
          kind, line_items: cleaned, tax_rate: taxRate, ...t,
          notes: notes.trim() || null, payment_url: paymentUrl.trim() || null,
        });
        toast.success("Saved");
      } else {
        await createInvoice({
          team_id: teamId, project_id: projectId, kind, status: "draft",
          line_items: cleaned, tax_rate: taxRate, ...t, currency: "usd",
          notes: notes.trim() || null, payment_url: paymentUrl.trim() || null,
          created_by: userId, issued_at: null, due_at: null, paid_at: null,
        });
        toast.success(kind === "quote" ? "Quote created" : "Invoice created");
      }
      setShowEditor(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (inv: Invoice, status: Invoice["status"], extra?: Partial<Invoice>) => {
    try {
      await updateInvoice(inv.id, { status, ...extra });
      toast.success(`Marked ${status}`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  const convertToInvoice = async (inv: Invoice) => {
    try {
      await updateInvoice(inv.id, { kind: "invoice", status: "sent", issued_at: new Date().toISOString() });
      toast.success("Converted to invoice");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to convert");
    }
  };

  const remove = async (inv: Invoice) => {
    try {
      await deleteInvoice(inv.id);
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
      toast.success("Deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Quotes & Invoices</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openNew("quote")}><Plus className="h-4 w-4 mr-1" /> Quote</Button>
          <Button size="sm" variant="outline" onClick={() => openNew("invoice")}><Plus className="h-4 w-4 mr-1" /> Invoice</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : invoices.length === 0 ? (
        <Card><CardContent className="pt-5 pb-5 text-center text-sm text-muted-foreground">
          No quotes or invoices yet. Create a quote to estimate this job, then convert it to an invoice when the work is done.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium capitalize">{inv.kind}</span>
                    <Badge className={STATUS_STYLE[inv.status]}>{inv.status}</Badge>
                  </div>
                  <span className="font-semibold tabular-nums">{money(inv.total)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {inv.line_items.map((li) => li.description).filter(Boolean).join(", ") || "No line items"}
                </p>
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(inv)}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {inv.status === "draft" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStatus(inv, "sent")}>
                      <Send className="h-3 w-3 mr-1" /> Send
                    </Button>
                  )}
                  {inv.kind === "quote" && inv.status !== "void" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => convertToInvoice(inv)}>
                      <ArrowRightCircle className="h-3 w-3 mr-1" /> To invoice
                    </Button>
                  )}
                  {inv.kind === "invoice" && inv.status !== "paid" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600" onClick={() => setStatus(inv, "paid", { paid_at: new Date().toISOString() })}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Mark paid
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"><Trash2 className="h-3 w-3" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {inv.kind}?</AlertDialogTitle>
                        <AlertDialogDescription>This permanently removes the {inv.kind} ({money(inv.total)}).</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(inv)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "New"} {kind}</DialogTitle>
            <DialogDescription>Line items, tax, and an optional payment link your client can use.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Input
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                    className="flex-1"
                  />
                  <Input
                    type="number" placeholder="Qty" value={it.quantity || ""}
                    onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))}
                    className="w-16"
                  />
                  <Input
                    type="number" placeholder="Price" value={it.unit_price || ""}
                    onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))}
                    className="w-20"
                  />
                  <span className="w-16 text-sm text-right tabular-nums pt-2">{money((it.quantity || 0) * (it.unit_price || 0))}</span>
                  <Button size="icon" variant="ghost" className="h-9 w-8 shrink-0" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setItems((p) => [...p, { description: "", quantity: 1, unit_price: 0 }])}>
                  <Plus className="h-3 w-3 mr-1" /> Line
                </Button>
                <Button size="sm" variant="outline" onClick={addLaborLine}>
                  <Clock className="h-3 w-3 mr-1" /> Labor from tracked time
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tax rate (%)</Label>
                <Input type="number" value={taxRate || ""} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Labor rate ($/hr)</Label>
                <Input type="number" value={laborRate || ""} onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            <div>
              <Label>Payment link (optional)</Label>
              <Input placeholder="Your Stripe / PayPal / Square link" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Clients see a Pay button that opens this link.</p>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank-you note, etc." rows={2} />
            </div>

            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Tax ({taxRate || 0}%)</span><span className="tabular-nums">{money(totals.tax_amount)}</span></div>
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="tabular-nums">{money(totals.total)}</span></div>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}
              {editing ? "Save changes" : `Create ${kind}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
