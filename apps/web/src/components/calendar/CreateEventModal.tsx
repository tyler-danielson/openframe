import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Calendar, Clock, Repeat, Timer, MapPin, AlignLeft, Mic, Type } from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Calendar as CalendarType } from "@openframe/shared";
import { Button } from "../ui/Button";
import { PlacesAutocomplete } from "../ui/PlacesAutocomplete";
import { TouchDatePicker } from "../ui/TouchDatePicker";
import { TouchTimePicker } from "../ui/TouchTimePicker";
import { RecurrencePicker } from "./RecurrencePicker";
import { VoiceEventInput, isVoiceInputAvailable } from "./VoiceEventInput";
import { api } from "../../services/api";
import { useCalendarStore } from "../../stores/calendar";
import { useToast } from "../ui/Toaster";
import { cn } from "../../lib/utils";

// Round time up to the next 30-minute interval
function getRoundedTime(durationMinutes: number = 60): { startTime: Date; endTime: Date } {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = minutes <= 0 ? 0 : minutes <= 30 ? 30 : 60;

  const startTime = new Date(now);
  startTime.setMinutes(roundedMinutes, 0, 0);
  if (roundedMinutes === 60) {
    startTime.setMinutes(0);
    startTime.setHours(startTime.getHours() + 1);
  }

  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);
  return { startTime, endTime };
}

type InputMode = "type" | "talk";
type PickerTarget = "start" | "end";
type PickerType = "date" | "time";

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  calendars: CalendarType[];
}

export function CreateEventModal({ open, onClose, calendars }: CreateEventModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const defaultEventDuration = useCalendarStore((state) => state.defaultEventDuration);

  // Filter to only editable calendars
  const editableCalendars = calendars.filter((c) => !c.isReadOnly && (c.syncEnabled || c.provider === "local"));
  const defaultCalendar = editableCalendars.find((c) => c.isPrimary) ?? editableCalendars[0];

  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>("type");
  const hasVoice = isVoiceInputAvailable();

  // Form state
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
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);

  // Picker state
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>("start");
  const [activePicker, setActivePicker] = useState<PickerType | null>(null);
  const [showRepeats, setShowRepeats] = useState(false);

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
      setRecurrenceRule(null);
      setShowCountdown(false);
      setActivePicker(null);
      setPickerTarget("start");
      setShowRepeats(false);
      setInputMode("type");
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
      recurrenceRule?: string;
      metadata?: Record<string, unknown>;
    }) => api.createEvent(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      if (data.syncWarning) {
        toast({
          title: "Event created locally",
          description: data.syncWarning,
          type: "error",
        });
      }
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create event",
        description: error.message,
        type: "error",
      });
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

    const metadata: Record<string, unknown> = {};
    if (showCountdown) {
      metadata.showCountdown = true;
      metadata.countdownFormat = "dhm";
    }

    createEvent.mutate({
      calendarId,
      title: title.trim(),
      startTime: startDateTime,
      endTime: endDateTime,
      isAllDay,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      recurrenceRule: recurrenceRule ?? undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  };

  // Format time for display (12-hour)
  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const hour = h ?? 0;
    const minute = m ?? 0;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
  };

  const formatDateDisplay = (date: string) => {
    return format(new Date(date), "EEE, MMM d");
  };

  // Handle date change with auto-sync
  const handleDateChange = (target: PickerTarget, value: string) => {
    if (target === "start") {
      setStartDate(value);
      if (new Date(value) > new Date(endDate)) {
        setEndDate(value);
      }
    } else {
      setEndDate(value);
    }
  };

  // Handle time change
  const handleTimeChange = (target: PickerTarget, value: string) => {
    if (target === "start") {
      setStartTime(value);
    } else {
      setEndTime(value);
    }
  };

  // Toggle picker visibility
  const togglePicker = (target: PickerTarget, type: PickerType) => {
    if (pickerTarget === target && activePicker === type) {
      setActivePicker(null);
    } else {
      setPickerTarget(target);
      setActivePicker(type);
    }
  };

  // Handle voice transcript
  const handleVoiceTranscript = (text: string) => {
    setTitle(text);
    setInputMode("type");
  };

  // Get recurrence label
  const getRecurrenceLabel = () => {
    if (!recurrenceRule) return null;
    if (recurrenceRule === "FREQ=DAILY") return "Daily";
    if (recurrenceRule === "FREQ=WEEKLY") return "Weekly";
    if (recurrenceRule === "FREQ=MONTHLY") return "Monthly";
    if (recurrenceRule === "FREQ=YEARLY") return "Yearly";
    return "Custom";
  };

  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card shadow-xl data-[state=open]:animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <Dialog.Title className="text-lg font-semibold">New Event</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground touch-manipulation">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex flex-col md:flex-row">
              {/* ──────── LEFT COLUMN: Input ──────── */}
              <div className="flex-1 p-5 space-y-4 md:border-r md:border-border">
                {/* Input mode tabs (only show Talk if available) */}
                {hasVoice && (
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setInputMode("type")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors touch-manipulation",
                        inputMode === "type"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Type className="h-4 w-4" />
                      Type
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode("talk")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors touch-manipulation",
                        inputMode === "talk"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Mic className="h-4 w-4" />
                      Talk
                    </button>
                  </div>
                )}

                {/* Type mode */}
                {inputMode === "type" && (
                  <>
                    {/* Title */}
                    <div>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Event title"
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary touch-manipulation"
                        autoFocus
                        required
                      />
                    </div>

                    {/* Calendar chip row */}
                    <div>
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                        {editableCalendars.map((calendar) => (
                          <button
                            key={calendar.id}
                            type="button"
                            onClick={() => setCalendarId(calendar.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors touch-manipulation shrink-0",
                              calendarId === calendar.id
                                ? "bg-primary/10 border border-primary text-primary"
                                : "border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: calendar.color }}
                            />
                            {calendar.name}
                          </button>
                        ))}
                      </div>
                      {editableCalendars.length === 0 && (
                        <p className="text-sm text-muted-foreground">No editable calendars available</p>
                      )}
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-2">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-3 shrink-0" />
                      <div className="flex-1">
                        <PlacesAutocomplete
                          value={location}
                          onChange={setLocation}
                          placeholder="Add location"
                          className="rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="flex items-start gap-2">
                      <AlignLeft className="h-5 w-5 text-muted-foreground mt-3 shrink-0" />
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add description"
                        rows={2}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none touch-manipulation"
                      />
                    </div>
                  </>
                )}

                {/* Talk mode */}
                {inputMode === "talk" && (
                  <VoiceEventInput onTranscript={handleVoiceTranscript} />
                )}
              </div>

              {/* ──────── RIGHT COLUMN: Date/Time/Options ──────── */}
              <div className="flex-1 p-5 space-y-4 border-t border-border md:border-t-0 md:max-w-[320px]">
                {/* All day toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">All day</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAllDay(!isAllDay);
                      if (!isAllDay) setActivePicker(null);
                    }}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors touch-manipulation",
                      isAllDay ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                        isAllDay ? "translate-x-[22px]" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>

                {/* Start/End segmented control */}
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPickerTarget("start")}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium transition-colors touch-manipulation",
                      pickerTarget === "start"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerTarget("end")}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium transition-colors touch-manipulation",
                      pickerTarget === "end"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    End
                  </button>
                </div>

                {/* Selected date/time display */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => togglePicker(pickerTarget, "date")}
                    className={cn(
                      "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors touch-manipulation",
                      activePicker === "date"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">
                      {formatDateDisplay(pickerTarget === "start" ? startDate : endDate)}
                    </span>
                  </button>
                  {!isAllDay && (
                    <button
                      type="button"
                      onClick={() => togglePicker(pickerTarget, "time")}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors touch-manipulation",
                        activePicker === "time"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">
                        {formatTimeDisplay(pickerTarget === "start" ? startTime : endTime)}
                      </span>
                    </button>
                  )}
                </div>

                {/* Inline picker */}
                {activePicker === "date" && (
                  <TouchDatePicker
                    value={pickerTarget === "start" ? startDate : endDate}
                    onChange={(v) => handleDateChange(pickerTarget, v)}
                  />
                )}
                {activePicker === "time" && !isAllDay && (
                  <TouchTimePicker
                    value={pickerTarget === "start" ? startTime : endTime}
                    onChange={(v) => handleTimeChange(pickerTarget, v)}
                  />
                )}

                {/* Summary of both start and end */}
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-foreground">{formatDateDisplay(startDate)}</span>
                    {!isAllDay && <span> {formatTimeDisplay(startTime)}</span>}
                  </div>
                  <span className="mx-2">→</span>
                  <div>
                    <span className="font-medium text-foreground">{formatDateDisplay(endDate)}</span>
                    {!isAllDay && <span> {formatTimeDisplay(endTime)}</span>}
                  </div>
                </div>

                {/* Repeats toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRepeats(!showRepeats);
                      if (showRepeats) {
                        setRecurrenceRule(null);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border transition-colors touch-manipulation text-left",
                      showRepeats || recurrenceRule
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium flex-1">
                      {getRecurrenceLabel() ?? "Repeats"}
                    </span>
                    {recurrenceRule && (
                      <span className="text-xs text-primary font-medium">On</span>
                    )}
                  </button>
                  {showRepeats && (
                    <div className="mt-2">
                      <RecurrencePicker value={recurrenceRule} onChange={setRecurrenceRule} />
                    </div>
                  )}
                </div>

                {/* Countdown toggle */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Show countdown</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCountdown(!showCountdown)}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors touch-manipulation",
                      showCountdown ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                        showCountdown ? "translate-x-[22px]" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex gap-3 border-t border-border px-5 py-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 py-2.5 text-sm touch-manipulation"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 py-2.5 text-sm touch-manipulation"
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
