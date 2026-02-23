"use client";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AvailabilitySlot, Appointment } from "@/lib/types";

interface MonthCalendarProps {
  year: number;
  month: number; // 0-indexed
  slots: AvailabilitySlot[];
  appointments: Appointment[];
  onDayClick: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSlotContextMenu?: (slot: AvailabilitySlot, event: React.MouseEvent) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthCalendar({
  year, month, slots, appointments, onDayClick, onPrevMonth, onNextMonth, onSlotContextMenu,
}: MonthCalendarProps) {
  const { weeks, slotsByDay, appointmentsByDay } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const totalDays = lastDay.getDate();

    // Build grid of weeks
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= totalDays; d++) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    // Group slots by day
    const slotsByDay: Record<number, AvailabilitySlot[]> = {};
    for (const s of slots) {
      const d = new Date(s.start_time);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!slotsByDay[day]) slotsByDay[day] = [];
        slotsByDay[day].push(s);
      }
    }

    // Group appointments by day (using slot start_time)
    const appointmentsByDay: Record<number, Appointment[]> = {};
    for (const a of appointments) {
      if (!a.slot) continue;
      const d = new Date(a.slot.start_time);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!appointmentsByDay[day]) appointmentsByDay[day] = [];
        appointmentsByDay[day].push(a);
      }
    }

    return { weeks, slotsByDay, appointmentsByDay };
  }, [year, month, slots, appointments]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={onPrevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">
          {MONTH_NAMES[month]} {year}
        </h2>
        <Button variant="ghost" size="icon" onClick={onNextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}

        {weeks.flat().map((day, i) => {
          const daySlots = day ? slotsByDay[day] || [] : [];
          const dayAppts = day ? appointmentsByDay[day] || [] : [];
          const availableCount = daySlots.filter((s) => !s.is_booked).length;
          const bookedCount = dayAppts.filter((a) => a.status === "confirmed").length;
          const isToday = isCurrentMonth && day === todayDate;

          return (
            <div
              key={i}
              className={cn(
                "bg-background min-h-[80px] p-1.5 cursor-pointer hover:bg-accent/30 transition-colors",
                !day && "bg-muted/30 cursor-default",
              )}
              onClick={() => {
                if (day) onDayClick(new Date(year, month, day));
              }}
              onContextMenu={(e) => {
                if (!day || !onSlotContextMenu) return;
                const firstSlot = daySlots[0];
                if (firstSlot) {
                  e.preventDefault();
                  onSlotContextMenu(firstSlot, e);
                }
              }}
            >
              {day && (
                <>
                  <div className={cn(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                    isToday && "bg-primary text-primary-foreground",
                  )}>
                    {day}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {availableCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {availableCount}
                      </span>
                    )}
                    {bookedCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {bookedCount}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
