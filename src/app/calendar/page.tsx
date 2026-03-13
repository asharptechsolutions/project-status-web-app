"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
import { WeeklyScheduleEditor } from "@/components/weekly-schedule";
import { DayDetailSheet } from "@/components/day-detail-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CalendarDays, CalendarCheck, CalendarClock } from "lucide-react";
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
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    try {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      const [slotsData, settingsData] = await Promise.all([
        getAvailabilitySlots(orgId, start.toISOString(), end.toISOString()),
        getOfficeHoursSettings(orgId),
      ]);
      setSlots(slotsData);
      setSettings(settingsData);

      const slotIds = slotsData.map((s) => s.id);
      if (slotIds.length > 0) {
        const appts = await getAppointmentsBySlots(slotIds);
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

  const handleToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setSheetOpen(true);
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

  // Summary stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = today.toDateString();
    const todayAppts = appointments.filter(
      (a) => a.status === "confirmed" && a.slot && new Date(a.slot.start_time).toDateString() === todayStr
    ).length;
    const availableSlots = slots.filter((s) => !s.is_booked).length;
    const bookedSlots = appointments.filter((a) => a.status === "confirmed").length;
    return { todayAppts, availableSlots, bookedSlots };
  }, [slots, appointments]);

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
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set your weekly availability and manage appointments.
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Card className="border-transparent bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CalendarClock className="h-4.5 w-4.5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{loading ? "–" : stats.todayAppts}</p>
                <p className="text-xs text-muted-foreground mt-1">Today&apos;s appointments</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{loading ? "–" : stats.availableSlots}</p>
                <p className="text-xs text-muted-foreground mt-1">Available slots</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CalendarCheck className="h-4.5 w-4.5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{loading ? "–" : stats.bookedSlots}</p>
                <p className="text-xs text-muted-foreground mt-1">Booked this month</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content: weekly schedule + month calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          {/* Weekly schedule */}
          {orgId && userId && (
            <WeeklyScheduleEditor
              orgId={orgId}
              userId={userId}
              onScheduleApplied={() => loadDataRef.current()}
            />
          )}

          {/* Month calendar */}
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
              onToday={handleToday}
            />
          )}
        </div>

        {/* Day detail sheet */}
        {orgId && userId && (
          <DayDetailSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            date={selectedDate}
            slots={daySlots}
            appointments={dayAppointments}
            settings={settings}
            orgId={orgId}
            userId={userId}
            onSlotsChanged={() => loadDataRef.current()}
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
