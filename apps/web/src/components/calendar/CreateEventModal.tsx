import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Calendar } from "@openframe/shared";
import { Button } from "../ui/Button";
import { PlacesAutocomplete } from "../ui/PlacesAutocomplete";
import { api } from "../../services/api";

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  calendars: Calendar[];
}

export function CreateEventModal({ open, onClose, calendars }: CreateEventModalProps) {
  const queryClient = useQueryClient();

  // Filter to only editable calendars
  const editableCalendars = calendars.filter((c) => !c.isReadOnly && c.syncEnabled);
  const defaultCalendar = editableCalendars.find((c) => c.isPrimary) ?? editableCalendars[0];

  const [title, setTitle] = useState("");
  const [calendarId, setCalendarId] = useState(defaultCalendar?.id ?? "");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(format(new Date(), "HH:mm"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endTime, setEndTime] = useState(format(new Date(Date.now() + 60 * 60 * 1000), "HH:mm"));
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  // Update default calendar when calendars change
  useEffect(() => {
    if (!calendarId && defaultCalendar) {
      setCalendarId(defaultCalendar.id);
    }
  }, [defaultCalendar, calendarId]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setStartTime(format(new Date(), "HH:mm"));
      setEndDate(format(new Date(), "yyyy-MM-dd"));
      setEndTime(format(new Date(Date.now() + 60 * 60 * 1000), "HH:mm"));
      setIsAllDay(false);
      setLocation("");
      setDescription("");
      if (defaultCalendar) {
        setCalendarId(defaultCalendar.id);
      }
    }
  }, [open, defaultCalendar]);

  const createEvent = useMutation({
    mutationFn: (data: {
      calendarId: string;
      title: string;
      startTime: Date;
      endTime: Date;
      isAllDay: boolean;
      location?: string;
      description?: string;
    }) => api.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !calendarId) return;

    let startDateTime: Date;
    let endDateTime: Date;

    if (isAllDay) {
      startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);
      endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
    } else {
      startDateTime = new Date(`${startDate}T${startTime}`);
      endDateTime = new Date(`${endDate}T${endTime}`);
    }

    createEvent.mutate({
      calendarId,
      title: title.trim(),
      startTime: startDateTime,
      endTime: endDateTime,
      isAllDay,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  const selectedCalendar = calendars.find((c) => c.id === calendarId);

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card p-6 shadow-xl data-[state=open]:animate-slide-up">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-xl font-semibold">
              New Event
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                required
              />
            </div>

            {/* Calendar selection */}
            <div>
              <label className="block text-sm font-medium mb-1">Calendar</label>
              <div className="space-y-1">
                {editableCalendars.map((calendar) => (
                  <button
                    key={calendar.id}
                    type="button"
                    onClick={() => setCalendarId(calendar.id)}
                    className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      calendarId === calendar.id
                        ? "bg-primary/10 border border-primary"
                        : "border border-border hover:bg-accent"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: calendar.color }}
                    />
                    <span className="flex-1">{calendar.name}</span>
                    {calendar.isPrimary && (
                      <span className="text-xs text-muted-foreground">Primary</span>
                    )}
                  </button>
                ))}
              </div>
              {editableCalendars.length === 0 && (
                <p className="text-sm text-muted-foreground">No editable calendars available</p>
              )}
            </div>

            {/* All day toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="allDay" className="text-sm font-medium">
                All day
              </label>
            </div>

            {/* Date and time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                {!isAllDay && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                {!isAllDay && (
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                )}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <PlacesAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="Search for a location"
                className="rounded-md px-3 py-2 focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description"
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!title.trim() || !calendarId || createEvent.isPending}
              >
                {createEvent.isPending ? "Creating..." : "Create Event"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
