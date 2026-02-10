import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Calendar as CalendarType } from "@openframe/shared";
import { Button } from "../ui/Button";
import { PlacesAutocomplete } from "../ui/PlacesAutocomplete";
import { TouchDatePicker } from "../ui/TouchDatePicker";
import { TouchTimePicker } from "../ui/TouchTimePicker";
import { api } from "../../services/api";
import { useCalendarStore } from "../../stores/calendar";

// Round time up to the next 30-minute interval
function getRoundedTime(durationMinutes: number = 60): { startTime: Date; endTime: Date } {
  const now = new Date();
  const minutes = now.getMinutes();

  // Round up to next 30-minute mark
  const roundedMinutes = minutes <= 0 ? 0 : minutes <= 30 ? 30 : 60;

  const startTime = new Date(now);
  startTime.setMinutes(roundedMinutes, 0, 0);

  // If we rounded to 60, that means next hour
  if (roundedMinutes === 60) {
    startTime.setMinutes(0);
    startTime.setHours(startTime.getHours() + 1);
  }

  // End time is based on the duration setting
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);

  return { startTime, endTime };
}

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  calendars: CalendarType[];
}

export function CreateEventModal({ open, onClose, calendars }: CreateEventModalProps) {
  const queryClient = useQueryClient();
  const defaultEventDuration = useCalendarStore((state) => state.defaultEventDuration);

  // Filter to only editable calendars
  const editableCalendars = calendars.filter((c) => !c.isReadOnly && c.syncEnabled);
  const defaultCalendar = editableCalendars.find((c) => c.isPrimary) ?? editableCalendars[0];

  const [title, setTitle] = useState("");
  const [calendarId, setCalendarId] = useState(defaultCalendar?.id ?? "");
  const initialTimes = getRoundedTime(defaultEventDuration);
  const [startDate, setStartDate] = useState(format(initialTimes.startTime, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(format(initialTimes.startTime, "HH:mm"));
  const [endDate, setEndDate] = useState(format(initialTimes.endTime, "yyyy-MM-dd"));
  const [endTime, setEndTime] = useState(format(initialTimes.endTime, "HH:mm"));
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  // Touch picker visibility
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Update default calendar when calendars change
  useEffect(() => {
    if (!calendarId && defaultCalendar) {
      setCalendarId(defaultCalendar.id);
    }
  }, [defaultCalendar, calendarId]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      const { startTime: roundedStart, endTime: roundedEnd } = getRoundedTime(defaultEventDuration);
      setTitle("");
      setStartDate(format(roundedStart, "yyyy-MM-dd"));
      setStartTime(format(roundedStart, "HH:mm"));
      setEndDate(format(roundedEnd, "yyyy-MM-dd"));
      setEndTime(format(roundedEnd, "HH:mm"));
      setIsAllDay(false);
      setLocation("");
      setDescription("");
      setShowStartDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndDatePicker(false);
      setShowEndTimePicker(false);
      if (defaultCalendar) {
        setCalendarId(defaultCalendar.id);
      }
    }
  }, [open, defaultCalendar, defaultEventDuration]);

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

  // Format time for display (12-hour format)
  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const hour = h ?? 0;
    const minute = m ?? 0;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
  };

  // Format date for display
  const formatDateDisplay = (date: string) => {
    return format(new Date(date), "EEE, MMM d");
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card p-6 shadow-xl data-[state=open]:animate-slide-up">
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
                className="w-full rounded-md border border-border bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
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
                    className={`w-full flex items-center gap-3 rounded-md px-3 py-3 text-left text-base transition-colors touch-manipulation ${
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAllDay(!isAllDay)}
                className={`relative w-14 h-8 rounded-full transition-colors touch-manipulation ${
                  isAllDay ? "bg-primary" : "bg-muted"
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    isAllDay ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
              <label className="text-base font-medium">All day</label>
            </div>

            {/* Start Date & Time */}
            <div>
              <label className="block text-sm font-medium mb-2">Start</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowStartDatePicker(!showStartDatePicker);
                    setShowStartTimePicker(false);
                  }}
                  className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border text-left transition-colors touch-manipulation ${
                    showStartDatePicker
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span className="text-base font-medium">{formatDateDisplay(startDate)}</span>
                </button>
                {!isAllDay && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartTimePicker(!showStartTimePicker);
                      setShowStartDatePicker(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors touch-manipulation ${
                      showStartTimePicker
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-base font-medium">{formatTimeDisplay(startTime)}</span>
                  </button>
                )}
              </div>

              {/* Start Date Picker */}
              {showStartDatePicker && (
                <div className="mt-3">
                  <TouchDatePicker
                    value={startDate}
                    onChange={(value) => {
                      setStartDate(value);
                      // Auto-update end date if it's before start date
                      if (new Date(value) > new Date(endDate)) {
                        setEndDate(value);
                      }
                    }}
                  />
                </div>
              )}

              {/* Start Time Picker */}
              {showStartTimePicker && !isAllDay && (
                <div className="mt-3">
                  <TouchTimePicker value={startTime} onChange={setStartTime} />
                </div>
              )}
            </div>

            {/* End Date & Time */}
            <div>
              <label className="block text-sm font-medium mb-2">End</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEndDatePicker(!showEndDatePicker);
                    setShowEndTimePicker(false);
                  }}
                  className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border text-left transition-colors touch-manipulation ${
                    showEndDatePicker
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span className="text-base font-medium">{formatDateDisplay(endDate)}</span>
                </button>
                {!isAllDay && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowEndTimePicker(!showEndTimePicker);
                      setShowEndDatePicker(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors touch-manipulation ${
                      showEndTimePicker
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-base font-medium">{formatTimeDisplay(endTime)}</span>
                  </button>
                )}
              </div>

              {/* End Date Picker */}
              {showEndDatePicker && (
                <div className="mt-3">
                  <TouchDatePicker value={endDate} onChange={setEndDate} />
                </div>
              )}

              {/* End Time Picker */}
              {showEndTimePicker && !isAllDay && (
                <div className="mt-3">
                  <TouchTimePicker value={endTime} onChange={setEndTime} />
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <PlacesAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="Search for a location"
                className="rounded-md px-3 py-3 text-base focus:ring-2 focus:ring-primary"
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
                className="w-full rounded-md border border-border bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary resize-none touch-manipulation"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 py-3 text-base touch-manipulation"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 py-3 text-base touch-manipulation"
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
