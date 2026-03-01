import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { Calendar } from "lucide-react";
import { api } from "../../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { useCalendarStore } from "../../stores/calendar";
import { useCardBlockNav } from "./useCardBlockNav";
import { cn } from "../../lib/utils";
import type { CardViewCardProps } from "./types";

export function CalendarCard({ onClick, blockNavId }: CardViewCardProps) {
  const { blockNavClasses } = useCardBlockNav(blockNavId);
  const { calendars, dashboardCalendarIds, setCalendars } = useCalendarStore();
  const calendarMap = new Map(calendars.map((c) => [c.id, c]));
  const today = new Date();

  // Fetch calendars (same pattern as DashboardPage)
  const { data: calendarsData } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  useEffect(() => {
    if (calendarsData) {
      setCalendars(calendarsData);
    }
  }, [calendarsData, setCalendars]);

  // Fetch today's events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", "dashboard", "today", dashboardCalendarIds],
    queryFn: () => api.getEvents(startOfDay(today), endOfDay(today), dashboardCalendarIds),
    enabled: dashboardCalendarIds.length > 0,
  });

  // Sort: all-day first, then by start time
  const sortedEvents = [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const upcoming = sortedEvents.slice(0, 4);

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-accent/50 transition-all duration-300 flex flex-col",
        blockNavClasses
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Today's Schedule
          {events.length > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 bg-muted rounded-full" />
                <div className="h-4 flex-1 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : dashboardCalendarIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Calendar className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No calendars configured</p>
          </div>
        ) : upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Calendar className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No events today</p>
          </div>
        ) : (
          <div className="space-y-1">
            {upcoming.map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: calendarMap.get(event.calendarId)?.color ?? "#3B82F6" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{event.title}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {event.isAllDay ? "All day" : format(new Date(event.startTime), "h:mm a")}
                </span>
              </div>
            ))}
            {events.length > 4 && (
              <p className="text-xs text-muted-foreground mt-2">
                +{events.length - 4} more
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
