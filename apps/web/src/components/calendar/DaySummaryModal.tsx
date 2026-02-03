import * as Dialog from "@radix-ui/react-dialog";
import { X, Calendar, Clock, MapPin } from "lucide-react";
import { format, isSameDay } from "date-fns";
import type { CalendarEvent } from "@openframe/shared";

interface DaySummaryModalProps {
  date: Date | null;
  events: CalendarEvent[];
  open: boolean;
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function DaySummaryModal({ date, events, open, onClose, onSelectEvent }: DaySummaryModalProps) {
  if (!date) return null;

  // Filter events for this specific day
  const dayEvents = events.filter((event) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    // Include events that start on this day, or span across this day
    return isSameDay(eventStart, date) ||
           (eventStart < date && eventEnd > date) ||
           isSameDay(eventEnd, date);
  });

  // Sort events by start time, all-day events first
  const sortedEvents = [...dayEvents].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

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
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <Dialog.Title className="text-lg font-semibold">
                {format(date, "EEEE, MMMM d, yyyy")}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="p-1 hover:bg-muted rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Events List */}
          <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
            {sortedEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No events scheduled for this day
              </p>
            ) : (
              <div className="space-y-3">
                {sortedEvents.map((event) => {
                  const calendarColor = (event as CalendarEvent & { calendar?: { color: string } })
                    .calendar?.color ?? "#3B82F6";

                  return (
                    <button
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Color indicator */}
                        <div
                          className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
                          style={{ backgroundColor: calendarColor }}
                        />

                        <div className="flex-1 min-w-0">
                          {/* Event title */}
                          <h3 className="font-medium truncate">{event.title}</h3>

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
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
