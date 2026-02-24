"use client";
import { useCallback, useRef, useState } from "react";
import { format, isBefore, isAfter, isSameDay } from "date-fns";
import { CalendarIcon, X, Check } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onChangeStart: (date: Date | undefined) => void;
  onChangeEnd: (date: Date | undefined) => void;
  placeholder?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  placeholder = "Select date range",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  // Internal state for the two-click flow + hover preview
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [hoveredDay, setHoveredDay] = useState<Date | undefined>(undefined);
  const pickingEnd = useRef(false);

  // Sync internal state when popover opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        // Reset picking state; show existing range
        setRangeFrom(startDate);
        pickingEnd.current = false;
        setHoveredDay(undefined);
      }
      setOpen(nextOpen);
    },
    [startDate],
  );

  // Click handler — first click sets start, second sets end
  const handleSelect = useCallback(
    (range: DateRange | undefined) => {
      if (!pickingEnd.current) {
        // First click: set start date, enter "picking end" mode
        const from = range?.from;
        setRangeFrom(from);
        setHoveredDay(undefined);
        pickingEnd.current = true;
        onChangeStart(from);
        onChangeEnd(undefined);
      } else {
        // Second click: set end date, finalize
        const from = rangeFrom;
        let to = range?.to ?? range?.from;

        // Ensure from <= to; swap if user clicked before start
        if (from && to && isAfter(from, to)) {
          onChangeStart(to);
          onChangeEnd(from);
        } else {
          onChangeStart(from);
          onChangeEnd(to);
        }

        pickingEnd.current = false;
        setHoveredDay(undefined);
      }
    },
    [rangeFrom, onChangeStart, onChangeEnd],
  );

  // Build the visual range: when picking end, use hovered day as preview
  let visualRange: DateRange | undefined;
  if (pickingEnd.current && rangeFrom) {
    const previewEnd = hoveredDay;
    if (previewEnd) {
      // Show range in correct order regardless of hover direction
      if (isBefore(previewEnd, rangeFrom)) {
        visualRange = { from: previewEnd, to: rangeFrom };
      } else {
        visualRange = { from: rangeFrom, to: previewEnd };
      }
    } else {
      visualRange = { from: rangeFrom, to: rangeFrom };
    }
  } else if (startDate || endDate) {
    visualRange = { from: startDate, to: endDate };
  }

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChangeStart(undefined);
      onChangeEnd(undefined);
      pickingEnd.current = false;
      setRangeFrom(undefined);
      setHoveredDay(undefined);
    },
    [onChangeStart, onChangeEnd],
  );

  let label = placeholder;
  if (startDate && endDate) {
    label = `${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`;
  } else if (startDate) {
    label = `${format(startDate, "MMM d, yyyy")} – …`;
  } else if (endDate) {
    label = `… – ${format(endDate, "MMM d, yyyy")}`;
  }

  const rangeComplete = !!(startDate && endDate);
  const hint = pickingEnd.current
    ? "Now click the end date"
    : startDate
      ? "Click a date to pick a new start"
      : "Click a date to set the start";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !startDate && !endDate && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{label}</span>
          {(startDate || endDate) && (
            <X
              className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={visualRange}
          onSelect={handleSelect}
          onDayMouseEnter={(day) => {
            if (pickingEnd.current) setHoveredDay(day);
          }}
          onDayMouseLeave={() => {
            if (pickingEnd.current) setHoveredDay(undefined);
          }}
          numberOfMonths={2}
          autoFocus
        />
        <div className="border-t px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{hint}</span>
          <Button
            size="sm"
            variant={rangeComplete ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
