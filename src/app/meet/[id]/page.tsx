"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getAppointment } from "@/lib/data";
import type { Appointment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertTriangle, Video, CalendarDays } from "lucide-react";

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function MeetInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, orgId, isClient } = useAuth();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !userId || !orgId) return;
    try {
      // Scoped to the caller's team both here and via RLS, so a user can only
      // open an appointment (and its video room) within their own org.
      setAppointment(await getAppointment(id, orgId));
    } finally {
      setLoading(false);
    }
  }, [id, userId, orgId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!appointment || appointment.status === "cancelled") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="font-medium">Meeting not available</p>
            <p className="text-sm text-muted-foreground">
              This appointment doesn&apos;t exist, was cancelled, or you don&apos;t have access to it.
            </p>
            <Button variant="outline" onClick={() => router.push(isClient ? "/track/" : "/calendar/")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Room name derives from the appointment UUID — unguessable
  const roomUrl = `https://meet.jit.si/workflowz-${appointment.id}`;

  return (
    <div className="h-[100dvh] flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push(isClient ? "/track/" : "/calendar/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Video className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">
              {appointment.project_name || "Video call"}{appointment.client_name ? ` — ${appointment.client_name}` : ""}
            </p>
            {appointment.slot?.start_time && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> {formatSlotTime(appointment.slot.start_time)}
              </p>
            )}
          </div>
        </div>
      </header>
      <iframe
        src={roomUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="flex-1 w-full border-0"
        title="Video call"
      />
    </div>
  );
}

export default function MeetPage() {
  return (
    <AuthGate>
      <MeetInner />
    </AuthGate>
  );
}
