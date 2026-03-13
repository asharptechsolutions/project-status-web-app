"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createAvailabilitySlots, deleteAvailabilitySlot, deleteRecurringSlots, cancelAppointment } from "@/lib/data";
import type { AvailabilitySlot, Appointment, OfficeHoursSettings } from "@/lib/types";
import { toast } from "sonner";
import { Trash2, Repeat, X, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayDetailDialogProps {
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

const ROW_HEIGHT = 44;

function formatHour(h: number, m: number) {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function DayDetailDialog({
  open, onOpenChange, date, slots, appointments, settings, orgId, userId, onSlotsChanged,
}: DayDetailDialogProps) {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slot: AvailabilitySlot } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const duration = settings?.slot_duration_minutes || 30;
  const startHour = settings ? parseInt(settings.day_start.split(":")[0]) : 9;
  const endHour = settings ? parseInt(settings.day_end.split(":")[0]) : 17;

  const timeRows = useMemo(() => {
    const rows: { hour: number; minute: number; label: string }[] = [];
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += duration) {
        rows.push({ hour: h, minute: m, label: formatHour(h, m) });
      }
    }
    return rows;
  }, [startHour, endHour, duration]);

  // Build map of slot index → slot data for existing slots
  const slotMap = useMemo(() => {
    const map: Record<number, { slot: AvailabilitySlot; appointment?: Appointment }> = {};
    if (!date) return map;
    for (const s of slots) {
      const d = new Date(s.start_time);
      if (d.toDateString() !== date.toDateString()) continue;
      const idx = timeRows.findIndex(
        (r) => r.hour === d.getHours() && r.minute === d.getMinutes()
      );
      if (idx >= 0) {
        const appt = appointments.find((a) => a.slot_id === s.id && a.status === "confirmed");
        map[idx] = { slot: s, appointment: appt };
      }
    }
    return map;
  }, [slots, appointments, date, timeRows]);

  // Drag handlers
  const isDragging = dragStart !== null;
  const dragMin = isDragging ? Math.min(dragStart!, dragEnd ?? dragStart!) : -1;
  const dragMax = isDragging ? Math.max(dragStart!, dragEnd ?? dragStart!) : -1;

  const handleMouseDown = (idx: number) => {
    if (slotMap[idx]) return; // don't drag on existing slots
    setDragStart(idx);
    setDragEnd(idx);
  };

  const handleMouseEnter = (idx: number) => {
    if (dragStart === null) return;
    setDragEnd(idx);
  };

  const handleMouseUp = useCallback(async () => {
    if (dragStart === null || dragEnd === null || !date) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const min = Math.min(dragStart, dragEnd);
    const max = Math.max(dragStart, dragEnd);

    // Build slot list (skip existing)
    const newSlots: { team_id: string; created_by: string; start_time: string; end_time: string; is_booked: boolean; recurrence_group_id: null }[] = [];
    for (let i = min; i <= max; i++) {
      if (slotMap[i]) continue;
      const row = timeRows[i];
      const start = new Date(date);
      start.setHours(row.hour, row.minute, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);
      newSlots.push({
        team_id: orgId,
        created_by: userId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        is_booked: false,
        recurrence_group_id: null,
      });
    }

    setDragStart(null);
    setDragEnd(null);

    if (newSlots.length === 0) return;

    setCreating(true);
    try {
      await createAvailabilitySlots(newSlots);
      toast.success(`Created ${newSlots.length} slot${newSlots.length > 1 ? "s" : ""}`);
      onSlotsChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to create slots");
    } finally {
      setCreating(false);
    }
  }, [dragStart, dragEnd, date, slotMap, timeRows, duration, orgId, userId, onSlotsChanged]);

  // Attach mouseup to document so drag works even if mouse leaves grid
  useEffect(() => {
    if (dragStart === null) return;
    const handler = () => handleMouseUp();
    document.addEventListener("mouseup", handler);
    return () => document.removeEventListener("mouseup", handler);
  }, [dragStart, handleMouseUp]);

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, slot: AvailabilitySlot) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, slot });
  };

  const handleDeleteSlot = async (slot: AvailabilitySlot) => {
    try {
      await deleteAvailabilitySlot(slot.id);
      toast.success("Slot deleted");
      onSlotsChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
    setContextMenu(null);
  };

  const handleMakeRecurring = async (slot: AvailabilitySlot) => {
    setContextMenu(null);
    const groupId = crypto.randomUUID();
    const newSlots: { team_id: string; created_by: string; start_time: string; end_time: string; is_booked: boolean; recurrence_group_id: string }[] = [];

    for (let w = 1; w <= 12; w++) {
      const start = new Date(slot.start_time);
      start.setDate(start.getDate() + w * 7);
      const end = new Date(slot.end_time);
      end.setDate(end.getDate() + w * 7);
      newSlots.push({
        team_id: orgId,
        created_by: userId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        is_booked: false,
        recurrence_group_id: groupId,
      });
    }

    try {
      // Also update the original slot with the group ID
      await createAvailabilitySlots(newSlots);
      toast.success("Created 12 weekly recurring slots");
      onSlotsChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to create recurring slots");
    }
  };

  const handleDeleteRecurring = async (slot: AvailabilitySlot) => {
    setContextMenu(null);
    if (!slot.recurrence_group_id) return;
    try {
      await deleteRecurringSlots(slot.recurrence_group_id);
      toast.success("Deleted all recurring slots");
      onSlotsChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleCancelAppointment = async (appt: Appointment) => {
    try {
      await cancelAppointment(appt.id, appt.slot_id);
      toast.success("Appointment cancelled");
      onSlotsChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    }
  };

  if (!date) return null;

  const dateStr = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Summary counts for the day
  const availableCount = slots.filter((s) => !s.is_booked).length;
  const bookedCount = appointments.filter((a) => a.status === "confirmed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dateStr}</DialogTitle>
          <DialogDescription>
            Drag across time slots to create availability. Right-click a slot for more options.
          </DialogDescription>
        </DialogHeader>

        {/* Day summary */}
        {(availableCount > 0 || bookedCount > 0) && (
          <div className="flex items-center gap-3 text-xs">
            {availableCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-full px-2.5 py-1 font-medium">
                <Clock className="h-3 w-3" />
                {availableCount} open
              </span>
            )}
            {bookedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 bg-green-500/10 rounded-full px-2.5 py-1 font-medium">
                <User className="h-3 w-3" />
                {bookedCount} booked
              </span>
            )}
          </div>
        )}

        <div
          ref={gridRef}
          className="flex-1 overflow-y-auto border rounded-lg select-none"
          style={{ minHeight: 200 }}
        >
          {timeRows.map((row, idx) => {
            const entry = slotMap[idx];
            const inDrag = isDragging && idx >= dragMin && idx <= dragMax && !entry;
            const isBooked = entry?.slot.is_booked;
            const appt = entry?.appointment;
            const isFirst = idx === 0;

            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center px-3 gap-3 transition-colors",
                  !isFirst && "border-t",
                  entry && isBooked
                    ? "bg-green-500/10"
                    : entry
                    ? "bg-blue-500/10"
                    : inDrag
                    ? "bg-blue-500/15 dark:bg-blue-500/20"
                    : "hover:bg-accent/40",
                  creating && "pointer-events-none opacity-60",
                )}
                style={{ height: ROW_HEIGHT }}
                onMouseDown={() => handleMouseDown(idx)}
                onMouseEnter={() => handleMouseEnter(idx)}
                onContextMenu={(e) => {
                  if (entry) handleContextMenu(e, entry.slot);
                }}
              >
                <span className="text-xs text-muted-foreground w-20 shrink-0 font-medium">{row.label}</span>
                {entry && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    {appt ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium truncate text-green-700 dark:text-green-300">{appt.client_name}</span>
                        {appt.project_name && (
                          <span className="text-[10px] text-muted-foreground truncate">({appt.project_name})</span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleCancelAppointment(appt); }}
                          title="Cancel appointment"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Available</span>
                    )}
                    {!isBooked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDeleteSlot(entry.slot); }}
                        title="Delete slot"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed z-[100] bg-popover border rounded-lg shadow-lg py-1.5 min-w-[200px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {!contextMenu.slot.is_booked && !contextMenu.slot.recurrence_group_id && (
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded-sm flex items-center gap-2.5 transition-colors"
                onClick={() => handleMakeRecurring(contextMenu.slot)}
              >
                <Repeat className="h-3.5 w-3.5 text-muted-foreground" /> Make Recurring (Weekly)
              </button>
            )}
            {!contextMenu.slot.is_booked && (
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded-sm flex items-center gap-2.5 transition-colors"
                onClick={() => handleDeleteSlot(contextMenu.slot)}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" /> Delete Slot
              </button>
            )}
            {contextMenu.slot.recurrence_group_id && !contextMenu.slot.is_booked && (
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 rounded-sm flex items-center gap-2.5 text-destructive transition-colors"
                onClick={() => handleDeleteRecurring(contextMenu.slot)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete All Recurring
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
