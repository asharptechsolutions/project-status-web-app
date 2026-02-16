"use client";
import { useState } from "react";
import { Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabaseAdmin } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export function OrgSetup() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { userId, refreshMember } = useAuth();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId) return;
    setLoading(true);
    setError("");

    try {
      // Create organization
      const { data: org, error: orgErr } = await supabaseAdmin
        .from("organizations")
        .insert({ name: name.trim() })
        .select("id")
        .single();
      if (orgErr) throw orgErr;

      // Create member record as admin
      const { error: memErr } = await supabaseAdmin
        .from("members")
        .insert({
          clerk_user_id: userId,
          org_id: org.id,
          role: "admin",
          email: "",
          name: name.trim(),
        });
      if (memErr) throw memErr;

      await refreshMember();
    } catch (err: any) {
      setError(err.message || "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="flex items-center gap-2 mb-6">
        <Workflow className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">ProjectStatus</span>
      </div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-2">Create Your Organization</h2>
        <p className="text-muted-foreground max-w-md">
          Set up your organization to start managing projects and inviting team members.
        </p>
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Organization Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Company"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
