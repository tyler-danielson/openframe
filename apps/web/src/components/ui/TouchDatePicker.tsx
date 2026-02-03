import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface TouchDatePickerProps {
  value: string; // yyyy-MM-dd format
  onChange: (value: string) => void;
  onSelect?: () => void; // Called after a date is selected (for closing popover)
  className?: string;
}

// Parse yyyy-MM-dd as local date (not UTC)
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day);
}

export function TouchDatePicker({ value, onChange, onSelect, className }: TouchDatePickerProps) {
  const selectedDate = value ? parseLocalDate(value) : new Date();
  const [viewDate, setViewDate] = useState(selectedDate);

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [viewDate]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handlePrevMonth = () => {
    setViewDate(subMonths(viewDate, 1));
  };

  const handleNextMonth = () => {
    setViewDate(addMonths(viewDate, 1));
  };

  const handleSelectDate = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"));
    onSelect?.();
  };

  const handleQuickSelect = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    onChange(format(date, "yyyy-MM-dd"));
    setViewDate(date);
    onSelect?.();
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  return (
    <div className={cn("p-3 bg-muted/30 rounded-xl", className)}>
      {/* Quick select buttons */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => handleQuickSelect(0)}
          className="flex-1 py-1.5 px-2 text-sm font-medium rounded-lg bg-muted hover:bg-accent transition-colors touch-manipulation"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect(1)}
          className="flex-1 py-1.5 px-2 text-sm font-medium rounded-lg bg-muted hover:bg-accent transition-colors touch-manipulation"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect(7)}
          className="flex-1 py-1.5 px-2 text-sm font-medium rounded-lg bg-muted hover:bg-accent transition-colors touch-manipulation"
        >
          +1 Week
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors touch-manipulation"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold">
          {format(viewDate, "MMMM yyyy")}
        </h3>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors touch-manipulation"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="h-6 flex items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {day[0]}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, viewDate);
          const isSelected = isSameDay(day, selectedDate);
          const isDayToday = isToday(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleSelectDate(day)}
              className={cn(
                "h-8 w-full flex items-center justify-center rounded-md text-sm font-medium transition-colors touch-manipulation",
                !isCurrentMonth && "text-muted-foreground/40",
                isCurrentMonth && !isSelected && "hover:bg-accent",
                isSelected && "bg-primary text-primary-foreground",
                isDayToday && !isSelected && "ring-1 ring-primary ring-inset"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
