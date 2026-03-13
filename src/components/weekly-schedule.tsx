"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getOfficeHoursSettings,
  upsertOfficeHoursSettings,
  clearFutureUnbookedSlots,
  createAvailabilitySlots,
} from "@/lib/data";
import type { WeeklySchedule, WeeklyScheduleDay } from "@/lib/types";

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 5; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const label = `${h12}:${m.toString().padStart(2, "0")} ${period}`;
    TIME_OPTIONS.push({ value, label });
  }
}

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney", "UTC",
];

const RECUR_OPTIONS = [
  { value: 2, label: "2 weeks" },
  { value: 4, label: "1 month" },
  { value: 13, label: "3 months" },
  { value: 26, label: "6 months" },
  { value: 52, label: "1 year" },
];

const DEFAULT_SCHEDULE: WeeklySchedule = [
  null,
  { start: "09:00", end: "17:00" },
  { start: "09:00", end: "17:00" },
  { start: "09:00", end: "17:00" },
  { start: "09:00", end: "17:00" },
  { start: "09:00", end: "17:00" },
  null,
];

interface WeeklyScheduleProps {
  orgId: string;
  userId: string;
  onScheduleApplied: () => void;
}

export function WeeklyScheduleEditor({ orgId, userId, onScheduleApplied }: WeeklyScheduleProps) {
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE);
  const [slotDuration, setSlotDuration] = useState(30);
  const [timezone, setTimezone] = useState("America/New_York");
  const [recurWeeks, setRecurWeeks] = useState(13); // ~3 months default
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getOfficeHoursSettings(orgId)
      .then((s) => {
        if (s) {
          setSlotDuration(s.slot_duration_minutes);
          setTimezone(s.timezone);
          if (s.weekly_schedule) {
            setSchedule(s.weekly_schedule);
            setDirty(false); // existing schedule loaded — no unsaved changes
          } else {
            setDirty(true); // no schedule yet — prompt user to apply
          }
        } else {
          setDirty(true); // no settings at all — prompt user to apply
        }
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  const updateDay = (dayIndex: number, updates: Partial<WeeklyScheduleDay>) => {
    setSchedule((prev) => {
      const next = [...prev];
      const existing = next[dayIndex];
      if (existing) {
        next[dayIndex] = { ...existing, ...updates };
      }
      return next;
    });
    setDirty(true);
  };

  const toggleDay = (dayIndex: number) => {
    setSchedule((prev) => {
      const next = [...prev];
      next[dayIndex] = next[dayIndex] ? null : { start: "09:00", end: "17:00" };
      return next;
    });
    setDirty(true);
  };

  const copyToWeekdays = () => {
    const monday = schedule[1];
    if (!monday) return;
    setSchedule((prev) => {
      const next = [...prev];
      for (let i = 1; i <= 5; i++) {
        next[i] = { ...monday };
      }
      return next;
    });
    toast.success("Copied Monday's hours to all weekdays");
    setDirty(true);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      // Compute global day_start / day_end from the schedule (for client booking compatibility)
      let earliestStart = "09:00";
      let latestEnd = "17:00";
      for (const day of schedule) {
        if (!day) continue;
        if (day.start < earliestStart) earliestStart = day.start;
        if (day.end > latestEnd) latestEnd = day.end;
      }

      // 1. Save settings + weekly schedule
      await upsertOfficeHoursSettings({
        team_id: orgId,
        day_start: earliestStart,
        day_end: latestEnd,
        timezone,
        slot_duration_minutes: slotDuration,
        weekly_schedule: schedule,
      });

      // 2. Clear future unbooked slots
      await clearFutureUnbookedSlots(orgId);

      // 3. Generate slots for the selected duration
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const allSlots: {
        team_id: string;
        created_by: string;
        start_time: string;
        end_time: string;
        is_booked: boolean;
        recurrence_group_id: null;
      }[] = [];

      for (let day = 0; day < recurWeeks * 7; day++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + day);

        const daySchedule = schedule[date.getDay()];
        if (!daySchedule) continue;

        const [startH, startM] = daySchedule.start.split(":").map(Number);
        const [endH, endM] = daySchedule.end.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        for (let m = startMinutes; m < endMinutes; m += slotDuration) {
          const slotStart = new Date(date);
          slotStart.setHours(Math.floor(m / 60), m % 60, 0, 0);

          // Skip past time slots
          if (slotStart <= now) continue;

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

          allSlots.push({
            team_id: orgId,
            created_by: userId,
            start_time: slotStart.toISOString(),
            end_time: slotEnd.toISOString(),
            is_booked: false,
            recurrence_group_id: null,
          });
        }
      }

      // Insert in batches
      for (let i = 0; i < allSlots.length; i += 500) {
        await createAvailabilitySlots(allSlots.slice(i, i + 500));
      }

      const label = RECUR_OPTIONS.find((o) => o.value === recurWeeks)?.label || `${recurWeeks} weeks`;
      toast.success(`Schedule applied — ${allSlots.length} slots created for the next ${label.toLowerCase()}`);
      setDirty(false);
      onScheduleApplied();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply schedule");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Weekly Availability</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 text-muted-foreground"
            onClick={copyToWeekdays}
            title="Copy Monday's hours to Tue–Fri"
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy to weekdays
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {/* Day rows */}
        {schedule.map((day, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
              day ? "bg-primary/5" : "bg-muted/30",
            )}
          >
            <Switch checked={!!day} onCheckedChange={() => toggleDay(i)} />
            <span
              className={cn(
                "text-sm font-medium w-9 shrink-0",
                !day && "text-muted-foreground",
              )}
            >
              {SHORT_DAYS[i]}
            </span>
            {day ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Select value={day.start} onValueChange={(v) => updateDay(i, { start: v })}>
                  <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <Select value={day.end} onValueChange={(v) => updateDay(i, { end: v })}>
                  <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Unavailable</span>
            )}
          </div>
        ))}

        {/* Settings */}
        <div className="border-t pt-3 mt-1 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slot duration</Label>
              <Select value={String(slotDuration)} onValueChange={(v) => { setSlotDuration(Number(v)); setDirty(true); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15" className="text-xs">15 minutes</SelectItem>
                  <SelectItem value="30" className="text-xs">30 minutes</SelectItem>
                  <SelectItem value="45" className="text-xs">45 minutes</SelectItem>
                  <SelectItem value="60" className="text-xs">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <Select value={String(recurWeeks)} onValueChange={(v) => { setRecurWeeks(Number(v)); setDirty(true); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECUR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <Select value={timezone} onValueChange={(v) => { setTimezone(v); setDirty(true); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz} className="text-xs">
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full" onClick={handleApply} disabled={applying || !dirty}>
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : !dirty ? (
              <Check className="h-4 w-4 mr-2" />
            ) : null}
            {!dirty ? "Schedule applied" : "Apply schedule"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
