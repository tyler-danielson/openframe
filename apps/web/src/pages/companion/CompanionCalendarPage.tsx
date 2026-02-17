import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Clock, Loader2 } from "lucide-react";
import { api } from "../../services/api";
import { useCompanion } from "./CompanionContext";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatEventTime(event: any) {
  if (event.isAllDay) return "All day";
  const start = new Date(event.startTime);
  return start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function CompanionCalendarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const companion = useCompanion();
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const { data: events, isLoading } = useQuery({
    queryKey: ["companion-calendar-events", year, month],
    queryFn: () => api.getCompanionEvents(monthStart, monthEnd),
    staleTime: 60_000,
  });

  const { data: calendars } = useQuery({
    queryKey: ["companion-calendars"],
    queryFn: () => api.getCompanionCalendars(),
    staleTime: 300_000,
  });

  // Build calendar color map
  const calendarColors = useMemo(() => {
    const map = new Map<string, string>();
    (calendars || []).forEach((cal: any) => {
      map.set(cal.id, cal.color || "hsl(var(--primary))");
    });
    return map;
  }, [calendars]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    (events || []).forEach((event: any) => {
      const start = new Date(event.startTime);
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    return map;
  }, [events]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const selectedKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
  const selectedEvents = eventsByDay.get(selectedKey) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-primary/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5 text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">
          {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-primary/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronRight className="h-5 w-5 text-primary" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-2">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 px-2 gap-y-0.5">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-11" />
        ))}
        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day);
          const key = `${year}-${month}-${day}`;
          const dayEvents = eventsByDay.get(key) || [];
          const isToday = isSameDay(date, today);
          const isSelected = isSameDay(date, selectedDate);
          // Get unique colors for dots (max 3)
          const dotColors = [...new Set(dayEvents.map((e: any) => calendarColors.get(e.calendarId) || "hsl(var(--primary))"))].slice(0, 3);

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(date)}
              className={`h-11 flex flex-col items-center justify-center rounded-lg transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : isToday
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-primary/5"
              }`}
            >
              <span className="text-sm">{day}</span>
              {dotColors.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dotColors.map((color, idx) => (
                    <div
                      key={idx}
                      className="h-1 w-1 rounded-full"
                      style={{ backgroundColor: isSelected ? "currentColor" : color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      <div className="flex-1 overflow-y-auto mt-2 border-t border-border">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-primary mb-2">
            {isSameDay(selectedDate, today)
              ? "Today"
              : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </h3>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents
                .sort((a: any, b: any) => {
                  if (a.isAllDay && !b.isAllDay) return -1;
                  if (!a.isAllDay && b.isAllDay) return 1;
                  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                })
                .map((event: any) => (
                  <button
                    key={event.id}
                    onClick={() => navigate(`/companion/calendar/event/${event.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-primary/5 transition-colors text-left"
                  >
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: calendarColors.get(event.calendarId) || "hsl(var(--primary))" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{event.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatEventTime(event)}
                        {event.location && <span className="truncate ml-1">- {event.location}</span>}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      {companion.canEditCalendar && (
        <button
          onClick={() => navigate(`/companion/calendar/event/new?date=${selectedDate.toISOString().split("T")[0]}`)}
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-10"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
