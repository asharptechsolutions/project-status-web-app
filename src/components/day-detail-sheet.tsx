"use client";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createAvailabilitySlots,
  deleteAvailabilitySlot,
  cancelAppointment,
  clearDayUnbookedSlots,
} from "@/lib/data";
import type { AvailabilitySlot, Appointment, OfficeHoursSettings } from "@/lib/types";
import { toast } from "sonner";
import { Trash2, X, Plus, Clock, User, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  slots: AvailabilitySlot[];
  appointments: Appointment[];
  settings: OfficeHoursSettings | null;
  orgId: string;
  userId: string;
  onSlotsChanged: () => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

// Generate time options for "Add slot" picker
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

export function DayDetailSheet({
  open,
  onOpenChange,
  date,
  slots,
  appointments,
  settings,
  orgId,
  userId,
  onSlotsChanged,
}: DayDetailSheetProps) {
  const [addTime, setAddTime] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const duration = settings?.slot_duration_minutes || 30;

  if (!date) return null;

  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Sort slots chronologically
  const sortedSlots = [...slots].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // Map slots with their appointments
  const slotEntries = sortedSlots.map((slot) => ({
    slot,
    appointment: appointments.find(
      (a) => a.slot_id === slot.id && a.status === "confirmed"
    ),
  }));

  const availableCount = slots.filter((s) => !s.is_booked).length;
  const bookedCount = appointments.filter((a) => a.status === "confirmed").length;

  const handleDeleteSlot = async (slot: AvailabilitySlot) => {
    try {
      await deleteAvailabilitySlot(slot.id);
      toast.success("Slot removed");
      onSlotsChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete slot");
    }
  };

  const handleCancelAppointment = async (appt: Appointment) => {
    try {
      await cancelAppointment(appt.id, appt.slot_id);
      toast.success("Appointment cancelled");
      onSlotsChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel appointment");
    }
  };

  const handleClearAvailable = async () => {
    if (availableCount === 0) return;
    try {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      await clearDayUnbookedSlots(orgId, dayStart.toISOString(), dayEnd.toISOString());
      toast.success(`Cleared ${availableCount} available slot${availableCount > 1 ? "s" : ""}`);
      onSlotsChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to clear slots");
    }
  };

  const handleAddSlot = async () => {
    if (!addTime || !date) return;
    setAdding(true);
    try {
      const [h, m] = addTime.split(":").map(Number);
      const start = new Date(date);
      start.setHours(h, m, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);

      await createAvailabilitySlots([
        {
          team_id: orgId,
          created_by: userId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          is_booked: false,
          recurrence_group_id: null,
        },
      ]);
      toast.success("Slot added");
      setAddTime("");
      onSlotsChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to add slot");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="text-lg">{dateStr}</SheetTitle>
          <SheetDescription>View and manage this day&apos;s schedule.</SheetDescription>
        </SheetHeader>

        {/* Summary badges + clear button */}
        <div className="flex items-center justify-between px-6 pb-4">
          <div className="flex items-center gap-2">
            {availableCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-full px-2.5 py-1">
                <Clock className="h-3 w-3" />
                {availableCount} open
              </span>
            )}
            {bookedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 rounded-full px-2.5 py-1">
                <User className="h-3 w-3" />
                {bookedCount} booked
              </span>
            )}
            {availableCount === 0 && bookedCount === 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                <CalendarOff className="h-3 w-3" />
                No slots
              </span>
            )}
          </div>
          {availableCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleClearAvailable}
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              Clear available
            </Button>
          )}
        </div>

        {/* Slot list */}
        <div className="flex-1 overflow-y-auto border-t">
          {slotEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <CalendarOff className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No slots scheduled for this day.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Add a one-off slot below or set up your weekly schedule.
              </p>
            </div>
          ) : (
            <div>
              {slotEntries.map(({ slot, appointment }) => {
                const isBooked = !!appointment;
                return (
                  <div
                    key={slot.id}
                    className={cn(
                      "flex items-center gap-3 px-6 py-3 border-b transition-colors",
                      isBooked ? "bg-green-500/5" : "bg-blue-500/5",
                    )}
                  >
                    {/* Time */}
                    <div className="shrink-0 w-[110px]">
                      <p className="text-sm font-medium">
                        {formatTime(slot.start_time)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        to {formatTime(slot.end_time)}
                      </p>
                    </div>

                    {/* Status / details */}
                    <div className="flex-1 min-w-0">
                      {appointment ? (
                        <div>
                          <p className="text-sm font-medium text-green-700 dark:text-green-300 truncate">
                            {appointment.client_name}
                          </p>
                          {appointment.project_name && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {appointment.project_name}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          Available
                        </p>
                      )}
                    </div>

                    {/* Action */}
                    {appointment ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleCancelAppointment(appointment)}
                        title="Cancel appointment"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDeleteSlot(slot)}
                        title="Remove slot"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add one-off slot */}
        <div className="border-t px-6 py-4 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Add a one-off slot
          </p>
          <div className="flex items-center gap-2">
            <Select value={addTime} onValueChange={setAddTime}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 px-3"
              disabled={!addTime || adding}
              onClick={handleAddSlot}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
