"use client";
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { getAvailableSlotsForClient, bookAppointment } from "@/lib/data";
import type { Project, AvailabilitySlot } from "@/lib/types";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
  userName: string;
  projects: Project[];
}

type Step = "project" | "date" | "slot" | "confirm";

function formatSlotTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function BookingDialog({
  open, onOpenChange, orgId, userId, userName, projects,
}: BookingDialogProps) {
  const [step, setStep] = useState<Step>("project");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [daySlots, setDaySlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [loadingDates, setLoadingDates] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      // Auto-select if only one project
      if (projects.length === 1) {
        setSelectedProject(projects[0]);
        setStep("date");
      } else {
        setSelectedProject(null);
        setStep("project");
      }
      setSelectedDate(undefined);
      setDaySlots([]);
      setSelectedSlot(null);
      setNotes("");
      setBooked(false);
      setCalendarMonth(new Date());
    }
  }, [open, projects]);

  // Fetch available dates for the visible calendar month
  const loadAvailableDates = useCallback(async (viewMonth: Date) => {
    setLoadingDates(true);
    try {
      const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
      const end = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0, 23, 59, 59);
      const slots = await getAvailableSlotsForClient(orgId, start.toISOString(), end.toISOString());
      const now = new Date();
      // Group by date string, only include future slots
      const dateSet = new Set<string>();
      for (const s of slots) {
        const d = new Date(s.start_time);
        if (d > now) {
          dateSet.add(d.toDateString());
        }
      }
      setAvailableDates(
        Array.from(dateSet).map((ds) => new Date(ds))
      );
    } catch {
      setAvailableDates([]);
    } finally {
      setLoadingDates(false);
    }
  }, [orgId]);

  // Load available dates when entering date step or changing month
  useEffect(() => {
    if (step === "date" && open) {
      loadAvailableDates(calendarMonth);
    }
  }, [step, open, calendarMonth, loadAvailableDates]);

  // Load slots when date is selected
  const loadSlots = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      const slots = await getAvailableSlotsForClient(orgId, start.toISOString(), end.toISOString());
      // Filter to only future slots
      const now = new Date();
      setDaySlots(slots.filter((s) => new Date(s.start_time) > now));
    } catch (err: any) {
      toast.error(err.message || "Failed to load slots");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (date) {
      setStep("slot");
      loadSlots(date);
    }
  };

  const handleSlotSelect = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    setStep("confirm");
  };

  const handleBook = async () => {
    if (!selectedSlot || !selectedProject) return;
    setBooking(true);
    try {
      await bookAppointment({
        team_id: orgId,
        slot_id: selectedSlot.id,
        project_id: selectedProject.id,
        client_id: userId,
        client_name: userName,
        notes: notes.trim() || undefined,
      });
      setBooked(true);
      toast.success("Appointment booked!");
    } catch (err: any) {
      toast.error(err.message || "Failed to book appointment");
      // If double-booking, go back to slot selection
      if (err.message?.includes("just booked")) {
        setStep("slot");
        setSelectedSlot(null);
        if (selectedDate) loadSlots(selectedDate);
      }
    } finally {
      setBooking(false);
    }
  };

  const goBack = () => {
    if (step === "confirm") setStep("slot");
    else if (step === "slot") setStep("date");
    else if (step === "date") {
      if (projects.length > 1) setStep("project");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {booked ? "Appointment Confirmed" : "Book a Call"}
          </DialogTitle>
          <DialogDescription>
            {booked
              ? "Your appointment has been scheduled."
              : step === "project"
              ? "Select which project this call is about."
              : step === "date"
              ? "Pick a date."
              : step === "slot"
              ? "Choose an available time."
              : "Confirm your booking."}
          </DialogDescription>
        </DialogHeader>

        {booked ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">{selectedProject?.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              {selectedSlot && (
                <p className="text-sm">
                  {formatSlotTime(selectedSlot.start_time)} - {formatSlotTime(selectedSlot.end_time)}
                </p>
              )}
            </div>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {step !== "project" && !(step === "date" && projects.length === 1) && (
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}

            {/* Step 1: Project selection */}
            {step === "project" && (
              <div className="space-y-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-4 py-3 rounded-md border hover:bg-accent/50 transition-colors"
                    onClick={() => { setSelectedProject(p); setStep("date"); }}
                  >
                    <p className="font-medium text-sm">{p.name}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Date picker */}
            {step === "date" && (
              <div className="flex flex-col items-center gap-2">
                <style>{`
                  .has-slots::after {
                    content: '';
                    position: absolute;
                    bottom: 2px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background-color: #3b82f6;
                  }
                `}</style>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  modifiers={{ hasSlots: availableDates }}
                  modifiersClassNames={{ hasSlots: "has-slots" }}
                  classNames={{
                    day: "h-11 w-11 text-center text-sm p-0 relative",
                    day_button: "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-normal ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-11 w-11 p-0 aria-selected:opacity-100",
                    weekday: "text-muted-foreground rounded-md w-11 font-normal text-[0.8rem]",
                  }}
                />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Available slots
                </div>
              </div>
            )}

            {/* Step 3: Time slot selection */}
            {step === "slot" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : daySlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No available slots on this date. Try another day.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                    {daySlots.map((slot) => (
                      <Button
                        key={slot.id}
                        variant="outline"
                        className="justify-start"
                        onClick={() => handleSlotSelect(slot)}
                      >
                        {formatSlotTime(slot.start_time)} - {formatSlotTime(slot.end_time)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Confirm */}
            {step === "confirm" && selectedSlot && (
              <div className="space-y-4">
                <div className="rounded-md border p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Project</span>
                    <span className="font-medium">{selectedProject?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {selectedDate?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">
                      {formatSlotTime(selectedSlot.start_time)} - {formatSlotTime(selectedSlot.end_time)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything you'd like to discuss..."
                    rows={3}
                  />
                </div>

                <Button onClick={handleBook} disabled={booking} className="w-full">
                  {booking ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Booking...</>
                  ) : (
                    "Confirm Booking"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
