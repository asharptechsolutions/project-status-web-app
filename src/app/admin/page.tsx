"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, FolderOpen, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { AdminStats } from "@/lib/types";

const STAT_CARDS = [
  { key: "totalOrgs" as const, label: "Organizations", icon: Building2, color: "text-blue-500" },
  { key: "totalUsers" as const, label: "Users", icon: Users, color: "text-green-500" },
  { key: "totalProjects" as const, label: "Projects", icon: FolderOpen, color: "text-orange-500" },
  { key: "totalMemberships" as const, label: "Memberships", icon: UserCheck, color: "text-purple-500" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats/");
        if (!res.ok) throw new Error("Failed to load stats");
        setStats(await res.json());
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Platform Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="pt-6 flex items-center gap-4">
              <Icon className={`h-8 w-8 ${color}`} />
              <div>
                <p className="text-2xl font-bold">{stats?.[key] ?? "—"}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
