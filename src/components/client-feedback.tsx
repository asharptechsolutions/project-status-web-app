"use client";
import { useEffect, useState, useCallback } from "react";
import { getMyProjectFeedback, submitProjectFeedback } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Post-completion rating + comment prompt, shown once the project is done. */
export function ClientFeedback({ projectId, teamId, clientId }: { projectId: string; teamId: string; clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const existing = await getMyProjectFeedback(projectId, clientId);
      if (existing) { setSubmitted(true); setRating(existing.rating); setComment(existing.comment || ""); }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [projectId, clientId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (rating === 0) { toast.error("Pick a rating first"); return; }
    setSaving(true);
    try {
      await submitProjectFeedback({ team_id: teamId, project_id: projectId, client_id: clientId, rating, comment: comment.trim() || null });
      setSubmitted(true);
      toast.success("Thanks for your feedback!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit feedback");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="mb-4">
      <CardContent className="pt-4 pb-4">
        {submitted ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Thanks for rating this project</span>
            <span className="flex items-center ml-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn("h-4 w-4", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
              ))}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">How did we do?</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}>
                  <Star className={cn("h-7 w-7 transition-colors", (hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                </button>
              ))}
            </div>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Anything you'd like to add? (optional)" />
            <Button size="sm" onClick={submit} disabled={saving || rating === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Submit feedback
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
