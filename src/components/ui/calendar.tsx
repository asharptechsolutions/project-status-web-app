"use client";
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: cn(buttonVariants({ variant: "outline" }), "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 absolute left-0.5 z-10"),
        button_next: cn(buttonVariants({ variant: "outline" }), "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 absolute right-0.5 z-10"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative",
        day_button: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        range_start: "bg-primary text-primary-foreground rounded-l-md rounded-r-none",
        range_end: "bg-primary text-primary-foreground rounded-r-md rounded-l-none",
        range_middle: "bg-primary/15 text-foreground rounded-none",
        today: "font-bold ring-1 ring-inset ring-primary/40 rounded-md",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";
export { Calendar };
