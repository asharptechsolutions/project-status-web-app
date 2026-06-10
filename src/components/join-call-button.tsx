"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import type { Appointment } from "@/lib/types";

const EARLY_MS = 10 * 60 * 1000; // joinable 10 min before the slot starts
const GRACE_MS = 30 * 60 * 1000; // stays joinable 30 min past the slot end

export function canJoinCall(appointment: Appointment, now: number = Date.now()): boolean {
  if (appointment.status !== "confirmed" || !appointment.slot) return false;
  const start = new Date(appointment.slot.start_time).getTime();
  const end = new Date(appointment.slot.end_time).getTime();
  return now >= start - EARLY_MS && now <= end + GRACE_MS;
}

interface JoinCallButtonProps {
  appointment: Appointment;
  size?: "default" | "sm";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  label?: string;
}

/** Renders nothing outside the joinable window; re-checks every 30s. */
export function JoinCallButton({ appointment, size = "sm", variant = "default", className, label = "Join video call" }: JoinCallButtonProps) {
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  if (!canJoinCall(appointment)) return null;

  return (
    <Button size={size} variant={variant} className={className} onClick={() => router.push(`/meet/${appointment.id}`)}>
      <Video className="h-4 w-4 mr-1" /> {label}
    </Button>
  );
}
