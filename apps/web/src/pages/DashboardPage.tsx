import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { api } from "../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { ClockWidget } from "../components/home-assistant/ClockWidget";
import { PhotoSlideshow } from "../components/photos/PhotoSlideshow";
import { useCalendarStore } from "../stores/calendar";

export function DashboardPage() {
  const { calendars, selectedCalendarIds, setCalendars } = useCalendarStore();

  // Fetch calendars
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
  const today = new Date();
  const { data: events = [] } = useQuery({
    queryKey: ["events", "today", selectedCalendarIds],
    queryFn: () =>
      api.getEvents(
        startOfDay(today),
        endOfDay(today),
        selectedCalendarIds
      ),
    enabled: selectedCalendarIds.length > 0,
  });

  // Fetch upcoming events (next 7 days)
  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ["events", "upcoming", selectedCalendarIds],
    queryFn: () =>
      api.getEvents(
        startOfDay(addDays(today, 1)),
        endOfDay(addDays(today, 7)),
        selectedCalendarIds
      ),
    enabled: selectedCalendarIds.length > 0,
  });

  // Group upcoming events by day
  const eventsByDay = upcomingEvents.reduce(
    (acc, event) => {
      const day = format(new Date(event.startTime), "yyyy-MM-dd");
      if (!acc[day]) acc[day] = [];
      acc[day].push(event);
      return acc;
    },
    {} as Record<string, typeof upcomingEvents>
  );

  const calendarMap = new Map(calendars.map((c) => [c.id, c]));

  return (
    <div className="flex h-full">
      {/* Main calendar area */}
      <div className="flex flex-1 flex-col p-6">
        {/* Header with clock */}
        <div className="mb-8">
          <ClockWidget />
        </div>

        {/* Today's events */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-muted-foreground">No events today</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <div
                      className="mt-1 h-3 w-3 rounded-full"
                      style={{
                        backgroundColor:
                          calendarMap.get(event.calendarId)?.color ?? "#3B82F6",
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.isAllDay
                          ? "All day"
                          : `${format(new Date(event.startTime), "h:mm a")} - ${format(new Date(event.endTime), "h:mm a")}`}
                      </p>
                      {event.location && (
                        <p className="text-sm text-muted-foreground">
                          {event.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming events */}
        <Card className="flex-1 overflow-auto">
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(eventsByDay).length === 0 ? (
              <p className="text-muted-foreground">No upcoming events</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(eventsByDay).map(([day, dayEvents]) => (
                  <div key={day}>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                      {format(new Date(day), "EEEE, MMMM d")}
                    </h3>
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2"
                        >
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                calendarMap.get(event.calendarId)?.color ??
                                "#3B82F6",
                            }}
                          />
                          <span className="flex-1 truncate text-sm">
                            {event.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {event.isAllDay
                              ? "All day"
                              : format(new Date(event.startTime), "h:mm a")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Photo sidebar */}
      <div className="w-80 border-l border-border">
        <PhotoSlideshow className="h-full" />
      </div>
    </div>
  );
}
