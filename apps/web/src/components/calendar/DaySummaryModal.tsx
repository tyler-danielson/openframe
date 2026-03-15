import { useState, useEffect, useRef, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Calendar, Clock, MapPin, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { format, isSameDay } from "date-fns";
import type { CalendarEvent } from "@openframe/shared";

interface DaySummaryModalProps {
  date: Date | null;
  events: CalendarEvent[];
  open: boolean;
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent?: () => void;
}

export function DaySummaryModal({ date, events, open, onClose, onSelectEvent, onAddEvent }: DaySummaryModalProps) {
  if (!date) return null;

  // Filter events for this specific day, then deduplicate
  const dayEvents = events.filter((event) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    // Include events that start on this day, or span across this day
    return isSameDay(eventStart, date) ||
           (eventStart < date && eventEnd > date) ||
           isSameDay(eventEnd, date);
  });

  // Deduplicate: same title + same start time = duplicate (covers recurring instance expansion)
  const seen = new Set<string>();
  const uniqueDayEvents = dayEvents.filter((event) => {
    const key = `${event.title?.toLowerCase().trim()}|${new Date(event.startTime).getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort events by start time, all-day events first
  const sortedEvents = [...uniqueDayEvents].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(sortedEvents.length);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // Find the next upcoming event index
  const now = new Date();
  const nextEventIndex = sortedEvents.findIndex(
    (event) => new Date(event.endTime) >= now
  );

  const updateScrollIndicators = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    setCanScrollUp(container.scrollTop > 10);
    setCanScrollDown(container.scrollTop + container.clientHeight < container.scrollHeight - 10);
  }, []);

  const scrollBy = useCallback((direction: "up" | "down") => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({ top: direction === "down" ? 200 : -200, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!open) return;

    // Small delay to let the dialog render
    const timer = setTimeout(() => {
      const container = scrollRef.current;
      if (!container) return;

      // Scroll to next upcoming event
      if (nextEventIndex > 0) {
        const el = container.querySelector(`[data-event-index="${nextEventIndex}"]`);
        if (el) {
          el.scrollIntoView({ block: "start" });
        }
      }

      // Initial scroll indicator check
      updateScrollIndicators();

      // Listen for scroll to update indicators
      container.addEventListener("scroll", updateScrollIndicators, { passive: true });

      const visibleIds = new Set<string>();

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.eventId;
            if (!id) continue;
            if (entry.isIntersecting) visibleIds.add(id);
            else visibleIds.delete(id);
          }
          setVisibleCount(visibleIds.size);
        },
        { root: container, threshold: 0.1 }
      );

      container.querySelectorAll('[data-event-id]').forEach(el => observer.observe(el));
      return () => {
        observer.disconnect();
        container.removeEventListener("scroll", updateScrollIndicators);
      };
    }, 50);

    return () => clearTimeout(timer);
  }, [open, sortedEvents.length, nextEventIndex, updateScrollIndicators]);

  const handleEventClick = (event: CalendarEvent) => {
    onClose();
    onSelectEvent(event);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <Dialog.Title className="text-lg font-semibold">
                  {format(date, "EEEE, MMMM d, yyyy")}
                </Dialog.Title>
              </div>
              {sortedEvents.length > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5 ml-7">
                  {visibleCount < sortedEvents.length
                    ? `${visibleCount} of ${sortedEvents.length}`
                    : `${sortedEvents.length}`} event{sortedEvents.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <Dialog.Close asChild>
              <button className="p-1 hover:bg-muted rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scroll container wrapper */}
          <div className="relative">
            {/* Scroll up indicator */}
            {canScrollUp && (
              <button
                onClick={() => scrollBy("up")}
                className="absolute top-0 left-0 right-0 z-10 flex justify-center py-1.5 bg-gradient-to-b from-card via-card/90 to-transparent cursor-pointer hover:from-muted transition-colors"
              >
                <ChevronUp className="h-5 w-5 text-muted-foreground animate-bounce" />
              </button>
            )}

            {/* Events List */}
            <div ref={scrollRef} className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {onAddEvent && (
                <button
                  onClick={() => { onClose(); onAddEvent(); }}
                  className="w-full flex items-center gap-2 p-3 mb-3 rounded-lg border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add New Event</span>
                </button>
              )}
              {sortedEvents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No events scheduled for this day
                </p>
              ) : (
                <div className="space-y-3">
                  {sortedEvents.map((event, index) => {
                    const isHoliday = event.calendarId === "federal-holidays";
                    const calendarColor = isHoliday
                      ? "#9333EA"
                      : ((event as CalendarEvent & { calendar?: { color: string } }).calendar?.color ?? "#3B82F6");
                    const isPast = new Date(event.endTime) < new Date();
                    const isNextEvent = index === nextEventIndex;

                    return (
                      <button
                        key={event.id}
                        data-event-id={event.id}
                        data-event-index={index}
                        onClick={() => handleEventClick(event)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isPast ? "opacity-50" : ""
                        } ${
                          isHoliday
                            ? "border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10"
                            : isNextEvent
                              ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                              : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Color indicator */}
                          <div
                            className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
                            style={{ backgroundColor: calendarColor }}
                          />

                          <div className="flex-1 min-w-0">
                            {/* Event title */}
                            <h3 className={`font-medium truncate ${isHoliday ? "text-purple-600 dark:text-purple-400" : ""}`}>
                              {isHoliday && <span className="mr-1">🇺🇸</span>}
                              {event.title}
                            </h3>

                            {/* Time */}
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Clock className="h-3.5 w-3.5" />
                              {event.isAllDay ? (
                                <span>All day</span>
                              ) : (
                                <span>
                                  {format(new Date(event.startTime), "h:mm a")} - {format(new Date(event.endTime), "h:mm a")}
                                </span>
                              )}
                            </div>

                            {/* Location */}
                            {event.location && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {/* End-of-list indicator */}
                  <div className="flex justify-center mt-[5px] mb-16">
                    <div className="w-1/3 h-px bg-primary/30 rounded-full" />
                  </div>
                </div>
              )}
            </div>

            {/* Scroll down indicator */}
            {canScrollDown && (
              <button
                onClick={() => scrollBy("down")}
                className="absolute bottom-0 left-0 right-0 z-10 flex justify-center py-1.5 bg-gradient-to-t from-card via-card/90 to-transparent cursor-pointer hover:from-muted transition-colors"
              >
                <ChevronDown className="h-5 w-5 text-muted-foreground animate-bounce" />
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
