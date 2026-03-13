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
  onToday?: () => void;
  onSlotContextMenu?: (slot: AvailabilitySlot, event: React.MouseEvent) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthCalendar({
  year, month, slots, appointments, onDayClick, onPrevMonth, onNextMonth, onToday, onSlotContextMenu,
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
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {MONTH_NAMES[month]} {year}
          </h2>
          {onToday && !isCurrentMonth && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2.5 text-muted-foreground" onClick={onToday}>
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b">
        {DAY_NAMES.map((d, i) => (
          <div
            key={d}
            className={cn(
              "px-2 py-2.5 text-center text-xs font-medium text-muted-foreground",
              (i === 0 || i === 6) && "text-muted-foreground/60",
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {weeks.flat().map((day, i) => {
          const daySlots = day ? slotsByDay[day] || [] : [];
          const dayAppts = day ? appointmentsByDay[day] || [] : [];
          const availableCount = daySlots.filter((s) => !s.is_booked).length;
          const bookedCount = dayAppts.filter((a) => a.status === "confirmed").length;
          const isToday = isCurrentMonth && day === todayDate;
          const isWeekend = i % 7 === 0 || i % 7 === 6;
          const isLastRow = i >= weeks.flat().length - 7;
          const isLastCol = i % 7 === 6;

          return (
            <div
              key={i}
              className={cn(
                "min-h-[90px] sm:min-h-[100px] p-2 cursor-pointer transition-colors relative",
                !isLastRow && "border-b",
                !isLastCol && "border-r",
                day ? "hover:bg-accent/40" : "cursor-default",
                !day && "bg-muted/20",
                isWeekend && day && "bg-muted/10",
                isToday && "bg-primary/5",
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
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                        isToday && "bg-primary text-primary-foreground font-semibold",
                        !isToday && isWeekend && "text-muted-foreground/70",
                      )}
                    >
                      {day}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 mt-1.5">
                    {availableCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-full px-1.5 py-0.5 w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {availableCount} open
                      </span>
                    )}
                    {bookedCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 rounded-full px-1.5 py-0.5 w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {bookedCount} booked
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 px-4 sm:px-5 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Available slots
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Booked appointments
        </div>
        <div className="hidden sm:flex items-center gap-1.5 ml-auto">
          Click a day to manage slots
        </div>
      </div>
    </div>
  );
}
