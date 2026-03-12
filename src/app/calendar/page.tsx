"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import {
  getAvailabilitySlots,
  getAppointmentsBySlots,
  getOfficeHoursSettings,
} from "@/lib/data";
import { createClient } from "@/lib/supabase";
import type { AvailabilitySlot, Appointment, OfficeHoursSettings } from "@/lib/types";
import { MonthCalendar } from "@/components/month-calendar";
import { DayDetailDialog } from "@/components/day-detail-dialog";
import { OfficeHoursDialog } from "@/components/office-hours-dialog";
import { Button } from "@/components/ui/button";
import { Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";

function CalendarPage() {
  const { orgId, userId, isAdmin } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [settings, setSettings] = useState<OfficeHoursSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [officeHoursOpen, setOfficeHoursOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    try {
      // Fetch slots for the visible month (with a bit of padding)
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      const [slotsData, settingsData] = await Promise.all([
        getAvailabilitySlots(orgId, start.toISOString(), end.toISOString()),
        getOfficeHoursSettings(orgId),
      ]);
      setSlots(slotsData);
      setSettings(settingsData);

      // Fetch appointments for these slots
      const slotIds = slotsData.map((s) => s.id);
      if (slotIds.length > 0) {
        const appts = await getAppointmentsBySlots(slotIds);
        // Attach slot data to appointments for month calendar
        const apptWithSlots = appts.map((a) => ({
          ...a,
          slot: slotsData.find((s) => s.id === a.slot_id),
        }));
        setAppointments(apptWithSlots);
      } else {
        setAppointments([]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }, [orgId, year, month]);

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  // Initial load + realtime
  useEffect(() => {
    setLoading(true);
    loadDataRef.current();

    if (!orgId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`calendar:${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "availability_slots", filter: `team_id=eq.${orgId}` },
        () => loadDataRef.current()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `team_id=eq.${orgId}` },
        () => loadDataRef.current()
      )
      .subscribe();

    const poll = setInterval(() => loadDataRef.current(), 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [orgId, year, month]);

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setDayDialogOpen(true);
  };

  // Filter slots and appointments for the selected day
  const daySlots = selectedDate
    ? slots.filter((s) => new Date(s.start_time).toDateString() === selectedDate.toDateString())
    : [];
  const dayAppointments = selectedDate
    ? appointments.filter(
        (a) => a.slot && new Date(a.slot.start_time).toDateString() === selectedDate!.toDateString()
      )
    : [];

  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
          <p className="text-muted-foreground text-center mt-10">Only admins can access the calendar.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Calendar</h1>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setOfficeHoursOpen(true)}>
              <Settings className="h-4 w-4 mr-2" /> Office Hours
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <MonthCalendar
            year={year}
            month={month}
            slots={slots}
            appointments={appointments}
            onDayClick={handleDayClick}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        )}

        {orgId && userId && (
          <DayDetailDialog
            open={dayDialogOpen}
            onOpenChange={setDayDialogOpen}
            date={selectedDate}
            slots={daySlots}
            appointments={dayAppointments}
            settings={settings}
            orgId={orgId}
            userId={userId}
            onSlotsChanged={() => loadDataRef.current()}
          />
        )}

        {orgId && (
          <OfficeHoursDialog
            open={officeHoursOpen}
            onOpenChange={setOfficeHoursOpen}
            orgId={orgId}
          />
        )}
      </main>
    </div>
  );
}

export default function CalendarRoute() {
  return (
    <AuthGate>
      <CalendarPage />
    </AuthGate>
  );
}
