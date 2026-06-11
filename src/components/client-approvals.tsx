"use client";
import { useState } from "react";
import type { ProjectStage } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Loader2, CheckCircle2, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";

/** Stages on this project awaiting the current client's sign-off. */
export function ClientApprovals({
  stages,
  onResolved,
}: {
  stages: ProjectStage[];
  onResolved: () => void;
}) {
  const pending = stages.filter((s) => s.requires_client_approval && s.approval_status === "pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNote, setShowNote] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (pending.length === 0) return null;

  const resolve = async (stageId: string, approve: boolean) => {
    setBusyId(stageId);
    try {
      const res = await fetch("/api/stages/approve/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, approve, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(approve ? "Approved — thank you!" : "Sent back with your note");
      setShowNote(null);
      setNote("");
      onResolved();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="mb-4 border-blue-500/40">
      <CardContent className="pt-4 pb-4 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-500" /> Your approval is needed
        </p>
        {pending.map((s) => (
          <div key={s.id} className="rounded-lg border p-3">
            <p className="text-sm font-medium">{s.name}</p>
            <p className="text-xs text-muted-foreground">Please review and approve so the team can continue.</p>
            {showNote === s.id ? (
              <div className="mt-2 space-y-2">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What needs to change?" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolve(s.id, false)} disabled={busyId === s.id}>
                    {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <MessageSquareWarning className="h-3.5 w-3.5 mr-1" />}
                    Send request
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowNote(null); setNote(""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => resolve(s.id, true)} disabled={busyId === s.id}>
                  {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowNote(s.id); setNote(""); }}>
                  Request changes
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
