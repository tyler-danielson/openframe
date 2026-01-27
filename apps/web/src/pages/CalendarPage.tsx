import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api } from "../services/api";
import { useCalendarStore } from "../stores/calendar";
import { CalendarView, EventModal, CreateEventModal } from "../components/calendar";
import { Button } from "../components/ui/Button";
import type { CalendarEvent } from "@openframe/shared";

export function CalendarPage() {
  const queryClient = useQueryClient();
  const {
    currentDate,
    view,
    selectedCalendarIds,
    calendars,
    setCalendars,
    setSelectedEvent,
    selectedEvent,
    weekStartsOn,
    familyName,
    timeFormat,
    cycleTimeFormat,
    navigateToday,
    navigatePrevious,
    navigateNext,
    setView,
    setCurrentDate,
  } = useCalendarStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeFade, setTimeFade] = useState(true);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle time format change with fade effect
  const handleTimeFormatChange = () => {
    setTimeFade(false);
    setTimeout(() => {
      cycleTimeFormat();
      setTimeFade(true);
    }, 300);
  };

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    let start: Date;
    let end: Date;

    switch (view) {
      case "month":
        start = startOfWeek(startOfMonth(currentDate), { weekStartsOn });
        end = endOfWeek(endOfMonth(currentDate), { weekStartsOn });
        break;
      case "week":
        start = startOfWeek(currentDate, { weekStartsOn });
        // Include next week for the "Next Week" preview cell
        end = endOfWeek(addWeeks(currentDate, 1), { weekStartsOn });
        break;
      case "day":
        start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
        break;
      case "agenda":
      default:
        start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        end = addMonths(start, 1);
        break;
    }

    return { start, end };
  }, [currentDate, view, weekStartsOn]);

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

  // Fetch events
  const { data: events = [] } = useQuery({
    queryKey: ["events", dateRange.start.toISOString(), dateRange.end.toISOString(), selectedCalendarIds],
    queryFn: () => api.getEvents(dateRange.start, dateRange.end, selectedCalendarIds),
    enabled: selectedCalendarIds.length > 0,
  });

  // Delete event mutation
  const deleteEvent = useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = (id: string) => {
    deleteEvent.mutate(id);
  };

  const handleUpdateEvent = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  // Handle clicking on a day/slot to navigate to day view
  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    // Navigate to day view for the selected date
    setCurrentDate(slotInfo.start);
    setView("day");
  };

  // Format time based on selected format
  const formattedTime = useMemo(() => {
    switch (timeFormat) {
      case "12h":
        return format(currentTime, "h:mm a");
      case "12h-seconds":
        return format(currentTime, "h:mm:ss a");
      case "24h":
        return format(currentTime, "HH:mm");
      case "24h-seconds":
        return format(currentTime, "HH:mm:ss");
      default:
        return format(currentTime, "h:mm a");
    }
  }, [currentTime, timeFormat]);

  // Format the header based on view
  const headerText = useMemo(() => {
    switch (view) {
      case "month":
        return format(currentDate, "MMMM yyyy");
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn });
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      case "agenda":
        return format(currentDate, "MMMM yyyy");
      default:
        return "";
    }
  }, [currentDate, view, weekStartsOn]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        {/* Navigation header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">{familyName}</h1>
            <button
              onClick={handleTimeFormatChange}
              className={`text-lg font-semibold text-muted-foreground hover:text-foreground transition-opacity duration-300 ${
                timeFade ? "opacity-100" : "opacity-0"
              }`}
              title="Click to change time format"
            >
              {formattedTime}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{headerText}</h2>
            <select
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium"
              value={view}
              onChange={(e) => setView(e.target.value as "month" | "week" | "day" | "agenda")}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
              <option value="agenda">Agenda</option>
            </select>
            <div className="flex items-center gap-1 ml-2">
              <Button variant="ghost" size="icon" onClick={navigatePrevious} title="Previous">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateToday}>
                TODAY
              </Button>
              <Button variant="ghost" size="icon" onClick={navigateNext} title="Next">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar view */}
        <div className="flex-1 p-4 relative">
          <CalendarView
            events={events}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
          />

          {/* Add event button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="absolute bottom-8 right-8 w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
            title="Add new event"
          >
            <Plus className="h-8 w-8" />
          </button>
        </div>
      </div>

      <EventModal
        event={selectedEvent}
        open={isModalOpen}
        onClose={handleCloseModal}
        onDelete={handleDeleteEvent}
        onUpdate={handleUpdateEvent}
      />

      <CreateEventModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        calendars={calendars}
      />
    </div>
  );
}
