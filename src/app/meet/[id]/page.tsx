"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getAppointment } from "@/lib/data";
import type { Appointment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, AlertTriangle, Video, VideoOff, Mic, MicOff,
  MonitorUp, PhoneOff, CalendarDays, Crown, UserX,
} from "lucide-react";
import DailyIframe, { type DailyCall, type DailyParticipant } from "@daily-co/daily-js";
import { cn } from "@/lib/utils";

type Phase = "loading" | "connecting" | "joined" | "left" | "error";

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

/** A single participant's video/audio, with track attachment handled via refs. */
function ParticipantTile({
  participant, isLocal, amOwner, onMute, onRemove,
}: {
  participant: DailyParticipant;
  isLocal: boolean;
  amOwner: boolean;
  onMute: (sessionId: string) => void;
  onRemove: (sessionId: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const videoTrack = participant.tracks?.video?.persistentTrack;
  const audioTrack = participant.tracks?.audio?.persistentTrack;
  const videoOn = participant.tracks?.video?.state === "playable";
  const audioOn = participant.tracks?.audio?.state === "playable";
  const name = participant.user_name || (isLocal ? "You" : "Guest");

  // Attach the video track and explicitly play(). Depends on videoOn too so it
  // re-runs whenever the tile flips between video and the avatar. autoplay of an
  // *unmuted* video is blocked by browsers, so the tile is always muted and the
  // participant's audio is played through the separate <audio> element below.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (videoTrack) {
      el.srcObject = new MediaStream([videoTrack]);
      el.play?.().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [videoTrack, videoOn]);

  // Remote audio plays through its own element; never play local audio (echo).
  useEffect(() => {
    const el = audioRef.current;
    if (isLocal || !el) return;
    if (audioTrack) {
      el.srcObject = new MediaStream([audioTrack]);
      el.play?.().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [audioTrack, isLocal]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
      {/* Always mounted so the ref is stable as video toggles on/off. Always
          muted — audio comes from the <audio> element; an unmuted video tile
          would be blocked from autoplaying and render blank. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn("h-full w-full object-cover", isLocal && "-scale-x-100", !videoOn && "invisible")}
      />
      {!videoOn && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
            {initials(name)}
          </div>
        </div>
      )}
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {/* Name + status */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
        <span className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
          {participant.owner && <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
          <span className="truncate">{name}{isLocal ? " (you)" : ""}</span>
        </span>
        {!audioOn && <MicOff className="h-4 w-4 shrink-0 text-white/80" />}
      </div>

      {/* Owner controls on remote tiles */}
      {amOwner && !isLocal && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100">
          {audioOn && (
            <Button
              size="icon" variant="secondary" className="h-7 w-7"
              title="Mute participant" onClick={() => onMute(participant.session_id)}
            >
              <MicOff className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="icon" variant="destructive" className="h-7 w-7"
            title="Remove from call" onClick={() => onRemove(participant.session_id)}
          >
            <UserX className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function MeetInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, orgId, isClient } = useAuth();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string>("");
  const [participants, setParticipants] = useState<DailyParticipant[]>([]);
  const [joinInfo, setJoinInfo] = useState<{ url: string; token: string; isOwner: boolean } | null>(null);

  const callRef = useRef<DailyCall | null>(null);
  // Where "Go back" / the header back arrow returns to. Clients go to their
  // project's tracking page — which needs the project id, so fall back to the
  // dashboard if the appointment isn't loaded (e.g. the error state). Admins go
  // to the calendar.
  const backTo = !isClient
    ? "/calendar/"
    : appointment?.project_id
      ? `/track/?id=${appointment.project_id}`
      : "/";

  // 1. Load the appointment (for the header) and request join credentials.
  const load = useCallback(async () => {
    if (!id || !userId || !orgId) return;
    try {
      const appt = await getAppointment(id, orgId);
      if (!appt || appt.status === "cancelled") {
        setPhase("error");
        setError("This appointment doesn't exist, was cancelled, or you don't have access to it.");
        return;
      }
      setAppointment(appt);

      const res = await fetch("/api/meet/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setError(data.error || "Couldn't start the video call.");
        return;
      }
      setJoinInfo({ url: data.url, token: data.token, isOwner: data.isOwner });
      setPhase("connecting");
    } catch (err: any) {
      setPhase("error");
      setError(err.message || "Couldn't start the video call.");
    }
  }, [id, userId, orgId]);

  useEffect(() => { load(); }, [load]);

  // 2. Create the call object and join once we have credentials.
  useEffect(() => {
    if (!joinInfo) return;
    let cancelled = false;

    (async () => {
      const existing = DailyIframe.getCallInstance();
      if (existing) await existing.destroy();
      const call = DailyIframe.createCallObject();
      callRef.current = call;

      const sync = () => { if (!cancelled) setParticipants(Object.values(call.participants())); };

      call
        .on("joined-meeting", () => { if (!cancelled) { setPhase("joined"); sync(); } })
        .on("participant-joined", sync)
        .on("participant-updated", sync)
        .on("participant-left", sync)
        .on("track-started", sync)
        .on("track-stopped", sync)
        .on("left-meeting", () => { if (!cancelled) setPhase("left"); })
        .on("error", (e) => {
          if (!cancelled) { setError(e?.errorMsg || "Video call error."); setPhase("error"); }
        });

      try {
        await call.join({ url: joinInfo.url, token: joinInfo.token });
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || "Failed to join the call."); setPhase("error"); }
      }
    })();

    return () => {
      cancelled = true;
      const c = callRef.current;
      callRef.current = null;
      if (c) c.leave().catch(() => {}).finally(() => c.destroy().catch(() => {}));
    };
  }, [joinInfo]);

  const local = participants.find((p) => p.local);
  const remotes = participants.filter((p) => !p.local);
  const amOwner = local?.owner ?? joinInfo?.isOwner ?? false;
  const micOn = local?.tracks?.audio?.state === "playable";
  const camOn = local?.tracks?.video?.state === "playable";
  const sharing = !!local?.tracks?.screenVideo && local.tracks.screenVideo.state !== "off";

  const toggleMic = () => callRef.current?.setLocalAudio(!micOn);
  const toggleCam = () => callRef.current?.setLocalVideo(!camOn);
  const toggleShare = () =>
    sharing ? callRef.current?.stopScreenShare() : callRef.current?.startScreenShare();
  const leave = () => callRef.current?.leave();
  const muteParticipant = (sid: string) => callRef.current?.updateParticipant(sid, { setAudio: false });
  const removeParticipant = (sid: string) => callRef.current?.updateParticipant(sid, { eject: true });

  if (phase === "loading" || phase === "connecting") {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {phase === "loading" ? "Loading…" : "Connecting to the call…"}
        </p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 pt-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <p className="font-medium">Can&apos;t join this call</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => router.push(backTo)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "left") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 pt-6 text-center">
            <PhoneOff className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="font-medium">You left the call</p>
            <div className="flex justify-center gap-2 pt-1">
              <Button variant="outline" onClick={() => router.push(backTo)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Go back
              </Button>
              <Button onClick={() => { setParticipants([]); setPhase("connecting"); setJoinInfo((j) => j && { ...j }); }}>
                Rejoin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // phase === "joined"
  const tiles = [local, ...remotes].filter(Boolean) as DailyParticipant[];
  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b bg-background px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={leave}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Video className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {appointment?.project_name || "Video call"}
              {appointment?.client_name ? ` — ${appointment.client_name}` : ""}
            </p>
            {appointment?.slot?.start_time && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> {formatSlotTime(appointment.slot.start_time)}
              </p>
            )}
          </div>
        </div>
        {amOwner && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Crown className="h-3.5 w-3.5" /> You&apos;re the host
          </span>
        )}
      </header>

      {/* Video grid */}
      <div className="group flex-1 overflow-y-auto p-4">
        <div
          className={cn(
            "mx-auto grid h-full max-w-5xl gap-3 content-center",
            tiles.length <= 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
          )}
        >
          {tiles.map((p) => (
            <ParticipantTile
              key={p.session_id}
              participant={p}
              isLocal={!!p.local}
              amOwner={amOwner}
              onMute={muteParticipant}
              onRemove={removeParticipant}
            />
          ))}
        </div>
        {remotes.length === 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Waiting for the other participant to join…
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 border-t bg-background px-4 py-3">
        <Button
          variant={micOn ? "outline" : "destructive"} size="icon" className="h-11 w-11 rounded-full"
          onClick={toggleMic} title={micOn ? "Mute" : "Unmute"}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button
          variant={camOn ? "outline" : "destructive"} size="icon" className="h-11 w-11 rounded-full"
          onClick={toggleCam} title={camOn ? "Turn camera off" : "Turn camera on"}
        >
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <Button
          variant={sharing ? "default" : "outline"} size="icon" className="h-11 w-11 rounded-full"
          onClick={toggleShare} title={sharing ? "Stop sharing" : "Share screen"}
        >
          <MonitorUp className="h-5 w-5" />
        </Button>
        <Button
          variant="destructive" size="icon" className="h-11 w-11 rounded-full"
          onClick={leave} title="Leave call"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
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
